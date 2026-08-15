import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { suggestNextStake } from "@/lib/dutching";
import { TeamJersey } from "@/components/TeamJersey";

import { AccessGuard } from "@/components/AccessGuard";
export const Route = createFileRoute("/history")({
  component: () => <AccessGuard><History /></AccessGuard>,
});

interface SelectionPick {
  outcome: "1" | "X" | "2";
  outcomeLabel: string;
  odds: number;
  bookmaker?: string;
  matchId?: string;
  matchLabel?: string;
}
interface BetSelection {
  id: string;
  rank?: number;
  picks: SelectionPick[];
  combinedOdds: number;
  aiProb?: number;
  reasoning?: string | null;
  stake: number;
  payout: number;
  status?: "pending" | "won" | "lost";
}
interface Bet {
  id: string;
  match_name: string;
  league: string | null;
  market: string;
  commence_time: string | null;
  total_stake: number;
  guaranteed_return: number;
  expected_profit: number;
  profit_margin: number;
  status: string;
  actual_profit: number | null;
  created_at: string;
  selections: BetSelection[];
}

const LOCAL_BETS_KEY = "bethub_bets";
const LOCAL_BANKROLL_KEY = "bethub_bankroll";
const OUTCOME_COLOR: Record<string, string> = {
  "1": "bg-success/20 text-success border-success/40",
  "X": "bg-warning/20 text-warning border-warning/40",
  "2": "bg-destructive/20 text-destructive border-destructive/40",
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function History() {
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [bankroll, setBankroll] = useState(1000);
  const [isGuest, setIsGuest] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [matchResults, setMatchResults] = useState<Record<string, { outcome: "1" | "X" | "2" | null; hg: number | null; ag: number | null; finished: boolean }>>({});

  const loadMatchResults = async (betsList: Bet[]) => {
    const ids = new Set<string>();
    for (const b of betsList) {
      const sels = Array.isArray(b.selections) ? b.selections : [];
      for (const s of sels) for (const p of (s.picks ?? [])) {
        const mid = (p as any).matchId;
        if (mid) ids.add(mid);
      }
    }
    if (ids.size === 0) { setMatchResults({}); return; }
    const { data } = await supabase.from("matches_cache").select("id, home_goals, away_goals, status_short, commence_time").in("id", Array.from(ids));
    const FINISHED_CODES = ["FT", "AET", "PEN"];
    const map: Record<string, { outcome: "1" | "X" | "2" | null; hg: number | null; ag: number | null; finished: boolean }> = {};
    for (const r of (data ?? []) as any[]) {
      const hg = r.home_goals; const ag = r.away_goals;
      const startMs = r.commence_time ? new Date(r.commence_time).getTime() : 0;
      const finished = FINISHED_CODES.includes(r.status_short ?? "") || (typeof hg === "number" && typeof ag === "number" && startMs > 0 && Date.now() - startMs > 150 * 60 * 1000);
      let outcome: "1" | "X" | "2" | null = null;
      if (finished && typeof hg === "number" && typeof ag === "number") {
        outcome = hg > ag ? "1" : hg < ag ? "2" : "X";
      }
      map[r.id] = { outcome, hg: typeof hg === "number" ? hg : null, ag: typeof ag === "number" ? ag : null, finished };
    }
    setMatchResults(map);
  };

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      setIsGuest(false);
      const { data: betsData } = await supabase.from("bets").select("*").order("created_at", { ascending: false });
      const list = (betsData as unknown as Bet[]) ?? [];
      setBets(list);
      loadMatchResults(list);
      const { data: profile } = await supabase.from("profiles").select("initial_bankroll").maybeSingle();
      if (profile) setBankroll(Number(profile.initial_bankroll));
    } else {
      setIsGuest(true);
      const local = JSON.parse(localStorage.getItem(LOCAL_BETS_KEY) || "[]");
      setBets(local);
      loadMatchResults(local);
      const br = Number(localStorage.getItem(LOCAL_BANKROLL_KEY)) || 1000;
      setBankroll(br);
    }
  };
  useEffect(() => { load(); }, []);

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  // Recalcula status/lucro da aposta inteira a partir das seleções individuais
  const recomputeBet = (bet: Bet, newSelections: BetSelection[]) => {
    const allDecided = newSelections.every((s) => s.status === "won" || s.status === "lost");
    const wonSel = newSelections.find((s) => s.status === "won");
    let actualProfit = 0;
    if (wonSel) {
      // Lucro = retorno da vencedora - soma dos stakes de todas as ativas
      actualProfit = wonSel.payout - newSelections.reduce((a, s) => a + s.stake, 0);
    } else if (allDecided) {
      // Todas perderam
      actualProfit = -newSelections.reduce((a, s) => a + s.stake, 0);
    }
    const status = wonSel ? "won" : (allDecided ? "lost" : "pending");
    return { selections: newSelections, status, actual_profit: allDecided || wonSel ? actualProfit : null };
  };

  const updateSelectionStatus = async (betId: string, selId: string, newStatus: "won" | "lost") => {
    const bet = bets?.find((b) => b.id === betId);
    if (!bet) return;
    const newSelections = bet.selections.map((s) =>
      s.id === selId ? { ...s, status: s.status === newStatus ? "pending" : newStatus } : s,
    ) as BetSelection[];
    // Regra: só pode existir UMA vencedora num cercamento (mutuamente exclusivas)
    if (newStatus === "won") {
      newSelections.forEach((s) => { if (s.id !== selId && s.status === "won") s.status = "lost"; });
    }
    const patch = recomputeBet(bet, newSelections);

    if (isGuest) {
      const local: Bet[] = JSON.parse(localStorage.getItem(LOCAL_BETS_KEY) || "[]");
      const updated = local.map((b) => b.id === betId ? { ...b, ...patch } : b);
      localStorage.setItem(LOCAL_BETS_KEY, JSON.stringify(updated));
      setBets(updated);
      toast.success("Resultado atualizado");
      return;
    }
    const { error } = await supabase.from("bets").update({
      selections: patch.selections as unknown as never,
      status: patch.status,
      actual_profit: patch.actual_profit,
    }).eq("id", betId);
    if (error) return toast.error(error.message);
    toast.success("Resultado atualizado");
    load();
  };

  const updateStatus = async (id: string, status: "won" | "lost", profit: number) => {
    if (isGuest) {
      const local: Bet[] = JSON.parse(localStorage.getItem(LOCAL_BETS_KEY) || "[]");
      const updated = local.map((b) => b.id === id ? { ...b, status, actual_profit: profit } : b);
      localStorage.setItem(LOCAL_BETS_KEY, JSON.stringify(updated));
      toast.success("Aposta atualizada");
      load();
      return;
    }
    const { error } = await supabase.from("bets").update({ status, actual_profit: profit }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Aposta atualizada");
    load();
  };

  const deleteBet = async (id: string) => {
    if (!confirm("Excluir esta aposta do histórico?")) return;
    if (isGuest) {
      const local: Bet[] = JSON.parse(localStorage.getItem(LOCAL_BETS_KEY) || "[]");
      localStorage.setItem(LOCAL_BETS_KEY, JSON.stringify(local.filter((b) => b.id !== id)));
      toast.success("Aposta excluída");
      load();
      return;
    }
    const { error } = await supabase.from("bets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Aposta excluída");
    load();
  };

  const updateBankroll = async (val: number) => {
    setBankroll(val);
    if (isGuest) {
      localStorage.setItem(LOCAL_BANKROLL_KEY, String(val));
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("profiles").upsert({ user_id: u.user.id, initial_bankroll: val }, { onConflict: "user_id" });
  };

  const settled = (bets ?? []).filter((b) => b.status !== "pending");
  const totalProfit = settled.reduce((acc, b) => acc + (Number(b.actual_profit) || 0), 0);
  const currentBankroll = bankroll + totalProfit;
  const lastMargin = bets?.[0]?.profit_margin ?? 1;
  const nextStake = suggestNextStake(currentBankroll, bankroll, lastMargin);
  const roi = bankroll > 0 ? (totalProfit / bankroll) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster richColors />
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <h1 className="text-3xl font-bold">Histórico & Bankroll</h1>

        <div className="grid md:grid-cols-4 gap-4 mt-6">
          <Card className="card-elev p-4">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Bankroll inicial</div>
            <Input type="number" value={bankroll} onChange={(e) => updateBankroll(Math.max(0, Number(e.target.value) || 0))} className="num text-2xl font-bold mt-1 border-0 px-0 h-auto bg-transparent" />
          </Card>
          <Card className="card-elev p-4">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Bankroll atual</div>
            <div className="num text-2xl font-bold mt-1">R$ {currentBankroll.toFixed(2)}</div>
          </Card>
          <Card className="card-elev p-4">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Lucro / ROI</div>
            <div className={`num text-2xl font-bold mt-1 ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
              R$ {totalProfit.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground num">{roi >= 0 ? "+" : ""}{roi.toFixed(2)}%</div>
          </Card>
          <Card className="card-elev p-4 border-primary/40">
            <div className="text-xs uppercase text-primary tracking-wider">Stake sugerido</div>
            <div className="num text-2xl font-bold mt-1 text-primary">R$ {nextStake.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">para próxima aposta</div>
          </Card>
        </div>

        <h2 className="text-xl font-semibold mt-10 mb-4">Apostas</h2>
        {!bets && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>}
        {bets && bets.length === 0 && (
          <Card className="card-elev p-10 text-center text-muted-foreground">Nenhuma aposta salva ainda.</Card>
        )}
        <div className="space-y-2">
          {bets?.map((b) => {
            const isOpen = expanded.has(b.id);
            const sels = Array.isArray(b.selections) ? b.selections : [];
            // Mostra a seta de expansão sempre que houver combinações salvas (qualquer aposta de cercamento/multi)
            const isCerc = sels.length > 0;
            return (
              <Card key={b.id} className="card-elev p-4">
                {/* HEADER — clicável para expandir */}
                <button
                  type="button"
                  onClick={() => isCerc && toggleExpand(b.id)}
                  className={`w-full text-left ${isCerc ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCerc && (
                          <span className="text-muted-foreground">
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </span>
                        )}
                        <span className="font-semibold">{b.match_name}</span>
                        {b.league && <Badge variant="outline" className="text-xs">{b.league}</Badge>}
                        <StatusBadge status={b.status} />
                        {isCerc && <Badge variant="secondary" className="text-[10px]">{sels.length} apostas</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 num">
                        🕒 {fmtDateTime(b.commence_time)} · {b.market} · investimento R$ {Number(b.total_stake).toFixed(2)} · retorno R$ {Number(b.guaranteed_return).toFixed(2)} · lucro previsto R$ {Number(b.expected_profit).toFixed(2)} · margem {Number(b.profit_margin).toFixed(2)}%
                      </div>
                    </div>
                    {b.status === "pending" && !isCerc ? (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="border-success text-success" onClick={() => updateStatus(b.id, "won", Number(b.expected_profit))}>Ganhou</Button>
                        <Button size="sm" variant="outline" className="border-destructive text-destructive" onClick={() => updateStatus(b.id, "lost", -Number(b.total_stake))}>Perdeu</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteBet(b.id)} title="Excluir aposta">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        {b.status !== "pending" && (
                          <div className={`num font-bold ${Number(b.actual_profit) >= 0 ? "text-success" : "text-destructive"}`}>
                            {Number(b.actual_profit) >= 0 ? "+" : ""}R$ {Number(b.actual_profit ?? 0).toFixed(2)}
                          </div>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => deleteBet(b.id)} title="Excluir aposta">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </button>

                {/* DETALHE EXPANDIDO — espelha exatamente a calculadora */}
                {isCerc && isOpen && (() => {
                  const totalStakeAll = sels.reduce((a, x) => a + (Number(x.stake) || 0), 0);
                  const totalReturnIfAny = sels.reduce((a, x) => Math.max(a, Number(x.payout) || 0), 0);
                  const guaranteed = sels.length > 0
                    ? Math.min(...sels.map((x) => (Number(x.payout) || 0) - totalStakeAll))
                    : 0;
                  return (
                    <div className="mt-4 border-t border-border pt-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
                        📊 Calculadora — {sels.length} apostas feitas
                      </div>

                      {/* Tabela igual à calculadora */}
                      <div className="border border-border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-foreground text-background">
                            <tr>
                              <th className="px-2 py-2 text-center w-12">#</th>
                              <th className="px-3 py-2 text-left">Cenário</th>
                              <th className="px-2 py-2 text-right w-20">% IA</th>
                              <th className="px-2 py-2 text-right w-16">Odd</th>
                              <th className="px-2 py-2 text-right w-28">Investimento</th>
                              <th className="px-2 py-2 text-right w-28">Retorno</th>
                              <th className="px-2 py-2 text-right w-28">Lucro</th>
                              <th className="px-2 py-2 text-center w-32">Resultado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sels.map((s, idx) => {
                              const picks = Array.isArray(s.picks) ? s.picks : [];
                              const stake = Number(s.stake) || 0;
                              const payout = Number(s.payout) || 0;
                              const combinedOdds = Number(s.combinedOdds) || 0;
                              const profit = payout - totalStakeAll;
                              const probShown = ((s.aiProb ?? 0) * 100);
                              const selStatus = s.status ?? "pending";
                              const pickResults = picks.map((p) => p.matchId ? matchResults[p.matchId] : undefined);
                              const allFinished = picks.length > 0 && pickResults.every((r) => r?.finished && r.outcome);
                              const autoWon = allFinished && picks.every((p, i) => pickResults[i]?.outcome === p.outcome);
                              const autoLost = allFinished && !autoWon;
                              const rowColor = autoWon
                                ? "bg-success/15"
                                : autoLost
                                ? "bg-destructive/15 opacity-80"
                                : selStatus === "won" ? "bg-success/10"
                                : selStatus === "lost" ? "bg-destructive/10 opacity-70"
                                : "";
                              return (
                                <tr key={s.id} className={`border-t ${idx % 2 ? "bg-muted/20" : ""} ${rowColor}`}>
                                  <td className="px-2 py-2 text-center">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border bg-background ${
                                      autoWon ? "border-success text-success" : autoLost ? "border-destructive text-destructive" : ""
                                    }`}>
                                      {s.rank ?? idx + 1}º
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    {picks.length === 0 ? (
                                      <span className="text-xs text-muted-foreground italic">Detalhes não disponíveis (aposta antiga)</span>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        {picks.map((p, i) => {
                                          const teamForJersey = p.outcome === "X" ? null : p.outcomeLabel;
                                          const r = pickResults[i];
                                          const pickHit = r?.finished && r.outcome === p.outcome;
                                          const pickMiss = r?.finished && r.outcome && r.outcome !== p.outcome;
                                          return (
                                            <div key={i} className={`flex items-center gap-2 ${pickMiss ? "text-destructive" : pickHit ? "text-success" : ""}`}>
                                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border ${OUTCOME_COLOR[p.outcome] ?? ""}`}>{p.outcome}</span>
                                              {teamForJersey ? (
                                                <TeamJersey team={teamForJersey} size={20} />
                                              ) : (
                                                <span className="text-base">🤝</span>
                                              )}
                                              <span className="text-xs font-medium truncate">{p.outcomeLabel}</span>
                                              {r?.finished && typeof r.hg === "number" && typeof r.ag === "number" && (
                                                <span className={`text-[10px] num font-bold px-1 rounded ${pickHit ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                                                  {r.hg} x {r.ag}
                                                </span>
                                              )}
                                              <span className="text-[10px] text-muted-foreground num ml-auto">@{Number(p.odds || 0).toFixed(2)}</span>
                                              {p.bookmaker && <span className="text-[9px] text-muted-foreground">({p.bookmaker})</span>}
                                            </div>
                                          );
                                        })}
                                        {s.reasoning && (
                                          <div className="text-[10px] text-muted-foreground italic mt-1">💡 {s.reasoning}</div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-right num font-bold text-primary">
                                    {s.aiProb !== undefined ? `${probShown.toFixed(1)}%` : "—"}
                                  </td>
                                  <td className="px-2 py-2 text-right num font-semibold">{combinedOdds.toFixed(2)}</td>
                                  <td className="px-2 py-2 text-right">
                                    <Badge variant="secondary" className="num">R$ {stake.toFixed(2)}</Badge>
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    <Badge variant="outline" className="num">R$ {payout.toFixed(2)}</Badge>
                                  </td>
                                  <td className={`px-2 py-2 text-right num font-bold ${profit >= 0 ? "text-success" : "text-destructive"}`}>
                                    {profit >= 0 ? "+" : ""}R$ {profit.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-2">
                                    <div className="flex gap-1 justify-center">
                                      <Button
                                        size="sm"
                                        variant={selStatus === "won" ? "default" : "outline"}
                                        className={selStatus === "won" ? "bg-success text-success-foreground h-7 px-2" : "border-success text-success h-7 px-2"}
                                        onClick={() => updateSelectionStatus(b.id, s.id, "won")}
                                        title="Esta combinação ganhou"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={selStatus === "lost" ? "default" : "outline"}
                                        className={selStatus === "lost" ? "bg-destructive text-destructive-foreground h-7 px-2" : "border-destructive text-destructive h-7 px-2"}
                                        onClick={() => updateSelectionStatus(b.id, s.id, "lost")}
                                        title="Esta combinação perdeu"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Rodapé de totais — igual à calculadora */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 p-3 rounded-md bg-muted/30 border border-border">
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Investimento total</div>
                          <div className="num text-lg font-bold">R$ {totalStakeAll.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Retorno máx. (se acertar 1)</div>
                          <div className="num text-lg font-bold text-success">R$ {totalReturnIfAny.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Lucro previsto (mín.)</div>
                          <div className={`num text-lg font-bold ${guaranteed >= 0 ? "text-success" : "text-destructive"}`}>
                            {guaranteed >= 0 ? "+" : ""}R$ {guaranteed.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Margem</div>
                          <div className="num text-lg font-bold">{Number(b.profit_margin).toFixed(2)}%</div>
                        </div>
                      </div>

                      <div className="text-[10px] text-muted-foreground italic mt-2">
                        💡 Num cercamento no máximo UMA combinação ganha. Marcar uma como "Ganhou" automaticamente marca as outras como "Perdeu".
                      </div>
                    </div>
                  );
                })()}
              </Card>
            );
          })}
        </div>
      </main>
      <ResponsibleFooter />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "won") return <Badge className="bg-success text-success-foreground">Ganho</Badge>;
  if (status === "lost") return <Badge className="bg-destructive text-destructive-foreground">Perdido</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}
