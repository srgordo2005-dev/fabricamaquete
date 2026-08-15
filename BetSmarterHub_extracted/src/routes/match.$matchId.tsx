import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { getMatchOdds, getLineupStatus, getMatchContext, analyzeMatch, type BookmakerOdds, type MatchContext } from "@/lib/server-fns/odds.functions";
import ReactMarkdown from "react-markdown";
import { calculateDutching, type DutchSelection } from "@/lib/dutching";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { MatchChat } from "@/components/MatchChat";
import { MatchVotes } from "@/components/MatchVotes";
import { TeamLogo } from "@/components/TeamLogo";
import { useAccess } from "@/hooks/useAccess";
import { LiveTactilePitch } from "@/components/LiveTactilePitch";

const searchSchema = z.object({ sportKey: z.string() });

export const Route = createFileRoute("/match/$matchId")({
  component: MatchDetail,
  validateSearch: searchSchema,
});

interface MatchData {
  id: string; home: string; away: string; commence_time: string; league: string; bookmakers: BookmakerOdds[];
  homeGoals?: number | null;
  awayGoals?: number | null;
  statusShort?: string | null;
  statusElapsed?: number | null;
  homeLogo?: string | null;
  awayLogo?: string | null;
  leagueLogo?: string | null;
}

const MARKET_LABELS: Record<string, string> = {
  h2h: "1X2 (Resultado)",
  totals: "Over / Under (Gols)",
};

function MatchDetail() {
  const { matchId } = Route.useParams();
  const { sportKey } = Route.useSearch();
  const navigate = useNavigate();
  const { isAdmin } = useAccess();

  const [data, setData] = useState<MatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lineup, setLineup] = useState<{ official: boolean; message: string } | null>(null);
  const [activeMarket, setActiveMarket] = useState<string>("h2h");
  const [picks, setPicks] = useState<DutchSelection[]>([]);
  const [stake, setStake] = useState<number>(100);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof analyzeMatch>> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisErr, setAnalysisErr] = useState<string | null>(null);
  const [context, setContext] = useState<MatchContext | null>(null);

  const runAnalysis = async () => {
    setAnalyzing(true); setAnalysisErr(null);
    try { setAnalysis(await analyzeMatch({ data: { matchId, sportKey } })); }
    catch (e) { setAnalysisErr((e as Error).message); }
    finally { setAnalyzing(false); }
  };

  useEffect(() => {
    const fetchAll = (silent = false) => {
      getMatchOdds({ data: { matchId, sportKey } })
        .then((m) => {
          setData(m);
          if (!silent) {
            getLineupStatus({ data: { home: m.home, away: m.away } }).then(setLineup).catch(() => {});
            getMatchContext({ data: { home: m.home, away: m.away } }).then(setContext).catch(() => {});
          }
        })
        .catch((e) => setError(e.message));
    };
    fetchAll();
    // Auto-refresh: 30s if live, 60s otherwise
    const isLive = data?.statusShort && ["1H","HT","2H","ET","BT","P","INT","LIVE"].includes(data.statusShort);
    const id = setInterval(() => fetchAll(true), isLive ? 30_000 : 60_000);
    return () => clearInterval(id);
  }, [matchId, sportKey]);

  // Best odds per outcome for active market
  const bestOdds = useMemo(() => {
    if (!data) return new Map<string, { price: number; bookmaker: string }>();
    const best = new Map<string, { price: number; bookmaker: string }>();
    for (const bm of data.bookmakers) {
      for (const o of bm.markets[activeMarket] ?? []) {
        const cur = best.get(o.name);
        if (!cur || o.price > cur.price) best.set(o.name, { price: o.price, bookmaker: bm.bookmaker });
      }
    }
    return best;
  }, [data, activeMarket]);

  const outcomeNames = useMemo(() => Array.from(bestOdds.keys()), [bestOdds]);

  const togglePick = (name: string) => {
    const best = bestOdds.get(name);
    if (!best) return;
    setPicks((prev) => {
      const exists = prev.find((p) => p.label === name);
      if (exists) return prev.filter((p) => p.label !== name);
      if (prev.length >= 6) { toast.warning("Máximo de 6 desfechos"); return prev; }
      return [...prev, { label: name, bookmaker: best.bookmaker, odds: best.price }];
    });
  };

  const dutching = useMemo(() => calculateDutching(picks, stake), [picks, stake]);

  const saveBet = async () => {
    if (!data || picks.length < 2) { toast.error("Selecione ao menos 2 desfechos"); return; }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    const betPayload = {
      match_id: data.id,
      match_name: `${data.home} vs ${data.away}`,
      league: data.league,
      commence_time: data.commence_time,
      market: MARKET_LABELS[activeMarket] ?? activeMarket,
      selections: dutching.selections as any,
      total_stake: dutching.totalStake,
      guaranteed_return: dutching.guaranteedReturn,
      expected_profit: dutching.profit,
      profit_margin: dutching.marginPct,
      status: "pending" as const,
      notes: lineup?.official ? null : "Risco Provisório (escalações não oficiais)",
    };

    if (userData.user) {
      const { error: insErr } = await supabase.from("bets").insert({ ...betPayload, user_id: userData.user.id });
      setSaving(false);
      if (insErr) { toast.error(insErr.message); return; }
    } else {
      // Save locally for guests
      const local = JSON.parse(localStorage.getItem("bethub_bets") || "[]");
      local.unshift({ ...betPayload, id: crypto.randomUUID(), created_at: new Date().toISOString(), actual_profit: null });
      localStorage.setItem("bethub_bets", JSON.stringify(local));
      setSaving(false);
    }
    toast.success("Aposta salva no histórico!");
    navigate({ to: "/history" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster richColors />
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-primary">← Voltar aos jogos</Link>

        {error && <Card className="card-elev p-6 border-destructive/50 mt-4"><p className="text-destructive">{error}</p></Card>}
        {!data && !error && <div className="space-y-3 mt-6"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>}

        {data && (
          <>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Badge variant="outline" className="text-primary border-primary/40">{data.league}</Badge>
                <h1 className="text-3xl font-bold mt-2 flex items-center flex-wrap gap-2">
                  <Link to="/team/$teamName" params={{ teamName: encodeURIComponent(data.home) }} className="hover:text-primary hover:underline underline-offset-4 inline-flex items-center gap-2">
                    <TeamLogo src={data.homeLogo ?? context?.homeForm?.teamLogo} name={data.home} size={32} />
                    {data.home}
                  </Link>
                  <span className="text-muted-foreground">vs</span>
                  <Link to="/team/$teamName" params={{ teamName: encodeURIComponent(data.away) }} className="hover:text-primary hover:underline underline-offset-4 inline-flex items-center gap-2">
                    <TeamLogo src={data.awayLogo ?? context?.awayForm?.teamLogo} name={data.away} size={32} />
                    {data.away}
                  </Link>
                </h1>
                <p className="text-sm text-muted-foreground num mt-1">
                  {new Date(data.commence_time).toLocaleString("pt-BR")}
                </p>
              </div>
              {lineup && (
                <Badge className={lineup.official ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
                  {lineup.message}
                </Badge>
              )}
            </div>

            {/* PLACAR / STATUS — quando jogo já começou ou terminou */}
            {(() => {
              const st = data.statusShort ?? "";
              const FINISHED = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];
              const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE"];
              const isFinished = FINISHED.includes(st);
              const isLive = LIVE.includes(st);
              const hasScore = typeof data.homeGoals === "number" && typeof data.awayGoals === "number";
              if (!hasScore && !isFinished && !isLive) return null;
              const statusLabel =
                st === "FT" ? "FINAL" :
                st === "AET" ? "FINAL (PRORROGAÇÃO)" :
                st === "PEN" ? "FINAL (PÊNALTIS)" :
                st === "HT" ? "INTERVALO" :
                st === "1H" ? `1º TEMPO${data.statusElapsed ? ` · ${data.statusElapsed}'` : ""}` :
                st === "2H" ? `2º TEMPO${data.statusElapsed ? ` · ${data.statusElapsed}'` : ""}` :
                st === "ET" ? "PRORROGAÇÃO" :
                st === "P" ? "PÊNALTIS" :
                st === "PST" ? "ADIADO" :
                st === "CANC" ? "CANCELADO" :
                st === "ABD" ? "ABANDONADO" :
                isLive ? "AO VIVO" :
                isFinished ? "ENCERRADO" : st;
              return (
                <Card className={`card-elev mt-4 p-5 ${
                  isLive ? "border-destructive/50 bg-destructive/5" :
                  isFinished ? "border-muted-foreground/30 bg-muted/30" :
                  ""
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                      <TeamLogo src={data.homeLogo ?? context?.homeForm?.teamLogo} name={data.home} size={40} />
                      <Link to="/team/$teamName" params={{ teamName: encodeURIComponent(data.home) }} className="text-base font-semibold hover:text-primary hover:underline underline-offset-4 truncate">{data.home}</Link>
                    </div>
                    <div className="flex items-center gap-3 num font-black text-5xl tabular-nums">
                      <span className={isLive ? "text-destructive" : "text-foreground"}>{data.homeGoals ?? "—"}</span>
                      <span className="text-muted-foreground text-2xl">×</span>
                      <span className={isLive ? "text-destructive" : "text-foreground"}>{data.awayGoals ?? "—"}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                      <Link to="/team/$teamName" params={{ teamName: encodeURIComponent(data.away) }} className="text-base font-semibold hover:text-primary hover:underline underline-offset-4 truncate">{data.away}</Link>
                      <TeamLogo src={data.awayLogo ?? context?.awayForm?.teamLogo} name={data.away} size={40} />
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <Badge className={
                      isLive ? "bg-destructive text-destructive-foreground animate-pulse" :
                      isFinished ? "bg-muted text-muted-foreground" :
                      "bg-secondary"
                    }>
                      {isLive && "🔴 "}{statusLabel}
                    </Badge>
                  </div>
                </Card>
              );
            })()}

            {/* CAMPO TÁTIL PRO - TRANSMISSÃO DA BOLA E EVENTOS */}
            <div className="mt-6">
              <LiveTactilePitch 
                matchId={data.id} 
                isAdmin={!!isAdmin} 
                homeName={data.home} 
                awayName={data.away} 
              />
            </div>

            {/* STATUS BANNER — quando contexto/odds parciais */}
            {context?.statusMessage && (
              <div className={`mt-4 p-3 rounded-md border text-sm flex items-center gap-2 ${
                context.status === "unavailable" ? "border-destructive/40 bg-destructive/10 text-destructive" :
                context.status === "partial" ? "border-warning/40 bg-warning/10 text-warning" :
                "border-primary/40 bg-primary/10 text-primary"
              }`}>
                <span>⚠</span>
                <span>{context.statusMessage}</span>
              </div>
            )}
            {data && data.bookmakers.length === 0 && (
              <div className="mt-4 p-3 rounded-md border border-warning/40 bg-warning/10 text-warning text-sm flex items-center gap-2">
                <span>⚠</span>
                <span>Odds indisponíveis no momento — provedores podem estar em manutenção ou cota atingida. As odds atualizam a cada 60s.</span>
              </div>
            )}

            {/* SEÇÕES DA PARTIDA — empilhadas verticalmente */}
            <div className="mt-6 space-y-6">
              <section className="space-y-4">
            {/* FLASHSCORE-STYLE CONTEXT PANEL */}
            {context && (context.fixture || context.h2h.length > 0 || context.standings.length > 0) && (
              <div className="mt-6 grid md:grid-cols-3 gap-4">
                {/* Detalhes do jogo */}
                <Card className="card-elev p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
                    {context.fixture?.leagueLogo && <img src={context.fixture.leagueLogo} alt="" className="w-4 h-4" />}
                    📍 Detalhes
                  </h3>
                  {context.fixture ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Competição</span><span className="font-medium text-right truncate ml-2">{context.fixture.leagueName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Rodada</span><span className="font-medium text-right truncate ml-2">{context.fixture.round}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Árbitro</span><span className="font-medium text-right">{context.fixture.referee ?? "—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Estádio</span><span className="font-medium text-right truncate ml-2">{context.fixture.venue}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Cidade</span><span className="font-medium text-right">{context.fixture.city}</span></div>
                      {context.homeRank && <div className="flex justify-between"><span className="text-muted-foreground truncate">{data.home}</span><span className="font-bold num">{context.homeRank}º</span></div>}
                      {context.awayRank && <div className="flex justify-between"><span className="text-muted-foreground truncate">{data.away}</span><span className="font-bold num">{context.awayRank}º</span></div>}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">Dados indisponíveis</p>}
                </Card>

                {/* Forma resumida */}
                <Card className="card-elev p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">📊 Forma (últimos 5)</h3>
                  {(context.homeForm || context.awayForm) ? (
                    <div className="space-y-3">
                      {[{ name: data.home, form: context.homeForm }, { name: data.away, form: context.awayForm }].map((t) => (
                        <div key={t.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium truncate">{t.name}</span>
                            {t.form && <span className="text-[10px] text-muted-foreground num">{t.form.wins}V {t.form.draws}E {t.form.losses}D · seq {t.form.streak}</span>}
                          </div>
                          <div className="flex gap-1">
                            {t.form?.last5.map((g, i) => (
                              <span key={i} title={`${g.venue === "H" ? "Casa" : "Fora"} vs ${g.opponent} ${g.gf}-${g.ga} (${g.competition})`}
                                className={`inline-block w-6 h-6 text-center text-[11px] font-bold leading-6 rounded ${g.result === "V" ? "bg-success/30 text-success" : g.result === "D" ? "bg-destructive/30 text-destructive" : "bg-warning/30 text-warning"}`}>{g.result}</span>
                            )) ?? <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                          {t.form && <div className="text-[10px] text-muted-foreground mt-1 num">{t.form.gfTotal} GP / {t.form.gaTotal} GC · {t.form.cleanSheets} CS · {t.form.failedToScore} sem marcar</div>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">Dados indisponíveis</p>}
                </Card>

                {/* H2H resumo */}
                <Card className="card-elev p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">⚔️ Confrontos diretos</h3>
                  {context.h2h.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                        <div className="p-2 rounded bg-success/10"><div className="text-[10px] text-muted-foreground truncate">{data.home}</div><div className="num font-bold text-success">{context.h2hSummary.homeWins}</div></div>
                        <div className="p-2 rounded bg-warning/10"><div className="text-[10px] text-muted-foreground">Empates</div><div className="num font-bold text-warning">{context.h2hSummary.draws}</div></div>
                        <div className="p-2 rounded bg-destructive/10"><div className="text-[10px] text-muted-foreground truncate">{data.away}</div><div className="num font-bold text-destructive">{context.h2hSummary.awayWins}</div></div>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {context.h2h.map((g, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] py-0.5 border-b border-border/30 last:border-0">
                            <span className="text-muted-foreground num text-[10px] w-14">{new Date(g.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
                            <span className="truncate flex-1 text-right">{g.home}</span>
                            <span className="num font-bold mx-1.5">{g.score}</span>
                            <span className="truncate flex-1">{g.away}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-xs text-muted-foreground">Sem histórico</p>}
                </Card>
              </div>
            )}

            {/* Desfalques + Standings — dentro de Geral */}
            {context && (context.homeInj.length > 0 || context.awayInj.length > 0 || context.standings.length > 0) && (
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <Card className="card-elev p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-warning mb-3">🚑 Não jogam</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="font-semibold mb-1 truncate">{data.home}</div>
                      {context.homeInj.length > 0 ? (
                        <ul className="space-y-0.5 text-muted-foreground">
                          {context.homeInj.map((p, i) => <li key={i} className="truncate">• {p}</li>)}
                        </ul>
                      ) : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div>
                      <div className="font-semibold mb-1 truncate">{data.away}</div>
                      {context.awayInj.length > 0 ? (
                        <ul className="space-y-0.5 text-muted-foreground">
                          {context.awayInj.map((p, i) => <li key={i} className="truncate">• {p}</li>)}
                        </ul>
                      ) : <span className="text-muted-foreground">—</span>}
                    </div>
                  </div>
                </Card>

                {context.standings.length > 0 && (
                  <Card className="card-elev p-4 overflow-hidden">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">🏆 Classificação</h3>
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-[11px]">
                        <thead className="text-muted-foreground sticky top-0 bg-background">
                          <tr><th className="text-left">#</th><th className="text-left">Equipe</th><th className="num">J</th><th className="num">SG</th><th className="num">P</th></tr>
                        </thead>
                        <tbody>
                          {context.standings.map((s) => {
                            const isHome = s.team.toLowerCase().includes(data.home.toLowerCase().split(" ")[0]);
                            const isAway = s.team.toLowerCase().includes(data.away.toLowerCase().split(" ")[0]);
                            const hl = isHome || isAway;
                            return (
                              <tr key={s.rank} className={hl ? "bg-primary/15 font-bold" : ""}>
                                <td className="num py-0.5">{s.rank}</td>
                                <td className="truncate max-w-[140px]"><span className="inline-flex items-center gap-1">{s.teamLogo && <img src={s.teamLogo} alt="" className="w-3.5 h-3.5" />}{s.team}</span></td>
                                <td className="num text-center">{s.played}</td>
                                <td className="num text-center">{s.gd}</td>
                                <td className="num text-center font-bold">{s.points}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}
              </section>

              <section className="space-y-4">
            {/* ÚLTIMOS 5 JOGOS DETALHADOS — estilo Flashscore */}
            {context && (context.homeForm?.last5.length || context.awayForm?.last5.length) ? (
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                {[{ name: data.home, form: context.homeForm, stats: context.homeStats }, { name: data.away, form: context.awayForm, stats: context.awayStats }].map((t) => (
                  <Card key={t.name} className="card-elev p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        {t.form?.teamLogo && <img src={t.form.teamLogo} alt="" className="w-5 h-5" />}
                        {t.name}
                      </h3>
                      {t.form && (
                        <div className="flex gap-1">
                          {t.form.last5.map((g, i) => (
                            <span key={i} className={`w-5 h-5 text-center text-[10px] font-bold leading-5 rounded ${g.result === "V" ? "bg-success/40 text-success" : g.result === "D" ? "bg-destructive/40 text-destructive" : "bg-warning/40 text-warning"}`}>{g.result}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {t.stats && (
                      <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
                        {t.stats.topScorer && (
                          <div className="p-2 rounded bg-muted/30 flex items-center gap-2">
                            {t.stats.topScorer.photo && <img src={t.stats.topScorer.photo} alt="" className="w-6 h-6 rounded-full" />}
                            <div className="min-w-0">
                              <div className="text-[9px] text-muted-foreground uppercase">Artilheiro</div>
                              <div className="font-semibold truncate">{t.stats.topScorer.name}</div>
                              <div className="num text-success">{t.stats.topScorer.goals} ⚽</div>
                            </div>
                          </div>
                        )}
                        {t.stats.topAssist && (
                          <div className="p-2 rounded bg-muted/30 flex items-center gap-2">
                            {t.stats.topAssist.photo && <img src={t.stats.topAssist.photo} alt="" className="w-6 h-6 rounded-full" />}
                            <div className="min-w-0">
                              <div className="text-[9px] text-muted-foreground uppercase">Assist.</div>
                              <div className="font-semibold truncate">{t.stats.topAssist.name}</div>
                              <div className="num text-primary">{t.stats.topAssist.assists} 🎯</div>
                            </div>
                          </div>
                        )}
                        <div className="p-2 rounded bg-muted/30">
                          <div className="text-[9px] text-muted-foreground uppercase">Média gols</div>
                          <div className="num font-bold">{t.stats.avgGoalsScored} pró / {t.stats.avgGoalsConceded} contra</div>
                        </div>
                        <div className="p-2 rounded bg-muted/30">
                          <div className="text-[9px] text-muted-foreground uppercase">Clean Sheet</div>
                          <div className="num font-bold">{t.stats.cleanSheetPct}%</div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      {t.form?.last5.map((g, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] py-1 border-b border-border/30 last:border-0">
                          <span className="text-muted-foreground num text-[10px] w-12">{new Date(g.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4">{g.competition.length > 18 ? g.competition.slice(0, 18) + "…" : g.competition}</Badge>
                          <span className={`text-[9px] font-bold w-4 ${g.venue === "H" ? "text-primary" : "text-muted-foreground"}`}>{g.venue}</span>
                          {g.opponentLogo && <img src={g.opponentLogo} alt="" className="w-4 h-4" />}
                          <span className="truncate flex-1">{g.opponent}</span>
                          <span className={`num font-bold w-10 text-right ${g.result === "V" ? "text-success" : g.result === "D" ? "text-destructive" : "text-warning"}`}>{g.gf}-{g.ga}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            ) : null}
              </section>

              <section className="space-y-4">
            {/* ESCALAÇÕES — Oficial ou Provável (último XI) */}
            {context && (context.homeLineup || context.awayLineup) && (
              <Card className="card-elev p-4 mt-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-primary">👥 Escalações</h3>
                  <Badge className={context.lineupOfficial ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
                    {context.lineupOfficial ? "✓ Oficiais confirmadas" : "⚠ Provável (baseado no último jogo)"}
                  </Badge>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {[{ name: data.home, lu: context.homeLineup }, { name: data.away, lu: context.awayLineup }].map((t) => (
                    <div key={t.name} className="border border-border rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-sm truncate">{t.name}</div>
                        {t.lu?.formation && <Badge variant="outline" className="text-[10px]">{t.lu.formation}</Badge>}
                      </div>
                      {t.lu?.coach && <div className="text-[10px] text-muted-foreground mb-2">Técnico: {t.lu.coach}</div>}
                      {t.lu?.startXI?.length ? (
                        <>
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Titulares (XI)</div>
                          <ul className="space-y-0.5 text-xs">
                            {t.lu.startXI.map((p, i) => (
                              <li key={i} className="flex items-center gap-2 py-0.5">
                                <span className="num text-[10px] text-muted-foreground w-5 text-center">{p.number ?? "—"}</span>
                                {p.pos && <Badge variant="secondary" className="text-[9px] px-1 py-0">{p.pos}</Badge>}
                                <span className="truncate flex-1">{p.name}</span>
                              </li>
                            ))}
                          </ul>
                          {t.lu.substitutes?.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-[10px] uppercase text-muted-foreground cursor-pointer">Banco ({t.lu.substitutes.length})</summary>
                              <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                                {t.lu.substitutes.map((p, i) => (
                                  <li key={i} className="flex items-center gap-2 py-0.5">
                                    <span className="num text-[10px] w-5 text-center">{p.number ?? "—"}</span>
                                    <span className="truncate">{p.name}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </>
                      ) : <p className="text-xs text-muted-foreground">Escalação não disponível</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
              </section>

              <section>
            <Card className="card-elev p-5 overflow-hidden">
              <Tabs value={activeMarket} onValueChange={setActiveMarket}>
                <TabsList>
                  {Object.keys(MARKET_LABELS).map((k) => {
                    const has = data.bookmakers.some((b) => b.markets[k]?.length);
                    return <TabsTrigger key={k} value={k} disabled={!has}>{MARKET_LABELS[k]}</TabsTrigger>;
                  })}
                </TabsList>
                {Object.keys(MARKET_LABELS).map((k) => (
                  <TabsContent key={k} value={k}>
                    <OddsTable
                      bookmakers={data.bookmakers}
                      market={k}
                      outcomes={k === activeMarket ? outcomeNames : []}
                      bestOdds={bestOdds}
                      picks={picks}
                      onTogglePick={togglePick}
                      active={k === activeMarket}
                    />
                  </TabsContent>
                ))}
              </Tabs>
              <p className="text-xs text-muted-foreground mt-3">
                A melhor odd de cada desfecho aparece em <span className="text-best">verde</span>.
              </p>
            </Card>
              </section>
            </div>

            {/* Chat + Votação ao vivo */}
            <div className="mt-6 grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2"><MatchChat matchId={data.id} commenceTime={data.commence_time} homeName={data.home} awayName={data.away} /></div>
              <div><MatchVotes matchId={data.id} homeName={data.home} awayName={data.away} /></div>
            </div>
          </>
        )}
      </main>
      <ResponsibleFooter />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "bad" }) {
  const cls = highlight === "good" ? "text-success" : highlight === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="p-2 rounded-md bg-muted/30">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`num font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function OddsTable({
  bookmakers, market, outcomes, bestOdds, picks, onTogglePick, active,
}: {
  bookmakers: BookmakerOdds[]; market: string; outcomes: string[];
  bestOdds: Map<string, { price: number; bookmaker: string }>;
  picks: DutchSelection[];
  onTogglePick: (name: string) => void;
  active: boolean;
}) {
  if (!active) return null;
  const cols = outcomes;
  if (cols.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Mercado indisponível.</p>;

  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-border">
            <th className="py-2 pr-4 font-medium text-muted-foreground">Bookmaker</th>
            {cols.map((c) => <th key={c} className="py-2 px-2 font-medium text-muted-foreground text-center">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {bookmakers.map((bm) => (
            <tr key={bm.bookmaker} className="border-b border-border/40 hover:bg-muted/20">
              <td className="py-2 pr-4 font-medium">{bm.bookmaker}</td>
              {cols.map((c) => {
                const o = bm.markets[market]?.find((x) => x.name === c);
                if (!o) return <td key={c} className="py-2 px-2 text-center text-muted-foreground">—</td>;
                const best = bestOdds.get(c);
                const isBest = best?.bookmaker === bm.bookmaker && best?.price === o.price;
                const picked = picks.some((p) => p.label === c && p.bookmaker === bm.bookmaker);
                return (
                  <td key={c} className="py-2 px-2 text-center">
                    <button
                      onClick={() => isBest && onTogglePick(c)}
                      disabled={!isBest}
                      className={`num px-3 py-1.5 rounded-md transition-all ${
                        isBest ? "text-best hover:bg-success/20 cursor-pointer" : "text-muted-foreground"
                      } ${picked ? "ring-2 ring-primary bg-primary/10" : ""}`}
                    >
                      {o.price.toFixed(2)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
