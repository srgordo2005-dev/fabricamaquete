import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTeamProfile } from "@/lib/server-fns/odds.functions";
import { AccessGuard } from "@/components/AccessGuard";
import { Header } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewsFeed } from "@/components/NewsFeed";

export const Route = createFileRoute("/team/$teamName")({
  component: () => <AccessGuard><TeamPage /></AccessGuard>,
});

type TeamProfile = Awaited<ReturnType<typeof getTeamProfile>>;
type Tab = "overview" | "fixtures" | "results" | "standings" | "squad" | "stats" | "transfers" | "trophies" | "news";

function TeamPage() {
  const { teamName } = Route.useParams();
  const decoded = decodeURIComponent(teamName);
  const [data, setData] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    setLoading(true);
    getTeamProfile({ data: { teamName: decoded } })
      .then(setData)
      .finally(() => setLoading(false));
  }, [decoded]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
          <div className="text-center text-muted-foreground py-20">Carregando perfil do time…</div>
        </main>
      </div>
    );
  }

  const t = data.team;
  const formatDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const formatDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Visão geral" },
    { id: "fixtures", label: "Próximos jogos" },
    { id: "results", label: "Resultados" },
    { id: "standings", label: "Classificação" },
    { id: "squad", label: "Elenco" },
    { id: "stats", label: "Estatísticas" },
    { id: "transfers", label: "Transferências" },
    { id: "trophies", label: "Títulos" },
    { id: "news", label: "Notícias" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-primary">← Voltar</Link>

        {/* HERO */}
        <Card className="p-6 mt-3">
          <div className="flex items-center gap-5 flex-wrap">
            {t?.logo && <img src={t.logo} alt={t.name} className="w-24 h-24 object-contain" />}
            <div className="flex-1 min-w-[200px]">
              <h1 className="text-3xl font-bold">{t?.name ?? decoded}</h1>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {t?.country && <span>🌍 {t.country}</span>}
                {t?.founded && <span>📅 Fundado em {t.founded}</span>}
                {t?.code && <span>🏷️ {t.code}</span>}
                {data.rank && data.league && <span>📊 {data.rank}º — {data.league.name}</span>}
              </div>
              {t?.venue && (
                <div className="text-xs text-muted-foreground mt-2">
                  🏟️ {t.venue}{t.venueCity ? `, ${t.venueCity}` : ""}{t.venueCapacity ? ` • ${t.venueCapacity.toLocaleString("pt-BR")} lugares` : ""}
                </div>
              )}
            </div>
            {data.league?.logo && (
              <div className="text-center">
                <img src={data.league.logo} alt={data.league.name} className="w-12 h-12 object-contain mx-auto" />
                <div className="text-[10px] text-muted-foreground mt-1">{data.league.name}</div>
              </div>
            )}
          </div>
          {data.statusMessage && (
            <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded">⚠ {data.statusMessage}</div>
          )}
        </Card>

        {/* TABS */}
        <div className="flex gap-1 overflow-x-auto mt-4 border-b border-border">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${tab === tb.id ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="mt-4 space-y-4">
          {tab === "overview" && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Resumo da forma */}
              {data.last.length > 0 && (
                <Card className="p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">Forma recente</h2>
                  <div className="flex gap-1.5 mb-3">
                    {data.last.slice(0, 8).map((g, i) => (
                      <span key={i} title={`${g.opponent} ${g.gf}-${g.ga}`} className={`w-7 h-7 grid place-items-center rounded text-xs font-bold ${g.result === "V" ? "bg-success/20 text-success" : g.result === "D" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>{g.result}</span>
                    ))}
                  </div>
                  {data.stats && (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded bg-success/10"><div className="text-[10px] text-muted-foreground">Vitórias</div><div className="num font-bold text-success">{data.stats.wins}</div></div>
                      <div className="p-2 rounded bg-muted"><div className="text-[10px] text-muted-foreground">Empates</div><div className="num font-bold">{data.stats.draws}</div></div>
                      <div className="p-2 rounded bg-destructive/10"><div className="text-[10px] text-muted-foreground">Derrotas</div><div className="num font-bold text-destructive">{data.stats.losses}</div></div>
                    </div>
                  )}
                </Card>
              )}

              {/* Próximo jogo */}
              {data.next[0] && (
                <Card className="p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">Próximo jogo</h2>
                  <div className="flex items-center gap-3">
                    {data.next[0].opponentLogo && <img src={data.next[0].opponentLogo} alt="" className="w-12 h-12 object-contain" />}
                    <div className="flex-1">
                      <div className="font-semibold">vs <Link to="/team/$teamName" params={{ teamName: encodeURIComponent(data.next[0].opponent) }} className="hover:text-primary underline-offset-2 hover:underline">{data.next[0].opponent}</Link></div>
                      <div className="text-xs text-muted-foreground">{formatDate(data.next[0].date)} • {data.next[0].competition}</div>
                      <Badge variant="outline" className="mt-1 text-[10px]">{data.next[0].venue === "H" ? "🏠 Casa" : "✈️ Fora"}</Badge>
                    </div>
                  </div>
                </Card>
              )}

              {/* Top artilheiro */}
              {data.topScorers[0] && (
                <Card className="p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">Artilheiro</h2>
                  <div className="flex items-center gap-3">
                    {data.topScorers[0].photo && <img src={data.topScorers[0].photo} alt="" className="w-14 h-14 rounded-full object-cover" />}
                    <div>
                      <div className="font-semibold">{data.topScorers[0].name}</div>
                      <div className="text-xs text-muted-foreground">⚽ {data.topScorers[0].goals} gols • 🎯 {data.topScorers[0].assists} assist. • {data.topScorers[0].appearances} jogos</div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Lesões */}
              {data.injuries.length > 0 && (
                <Card className="p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">⚕️ Lesões / suspensões ({data.injuries.length})</h2>
                  <ul className="text-xs space-y-1.5 max-h-40 overflow-y-auto">
                    {data.injuries.map((p, i) => (
                      <li key={i} className="flex justify-between gap-2"><span className="truncate">{p.name}</span><span className="text-muted-foreground shrink-0">{p.reason}</span></li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {tab === "news" && (
            <NewsFeed query={t?.name ?? decoded} title={`📰 Notícias de ${t?.name ?? decoded}`} max={15} />
          )}

          {tab === "fixtures" && (
            <Card className="p-4">
              {data.next.length === 0 ? <div className="text-center text-sm text-muted-foreground py-6">Nenhum jogo agendado.</div> : (
                <div className="divide-y divide-border">
                  {data.next.map((f) => (
                    <div key={f.id} className="py-3 flex items-center gap-3">
                      <div className="text-xs text-muted-foreground w-20 shrink-0">{formatDate(f.date)}</div>
                      {f.opponentLogo && <img src={f.opponentLogo} alt="" className="w-7 h-7 object-contain shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <Link to="/team/$teamName" params={{ teamName: encodeURIComponent(f.opponent) }} className="font-medium hover:text-primary truncate block">{f.venue === "H" ? "vs " : "@ "}{f.opponent}</Link>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">{f.competitionLogo && <img src={f.competitionLogo} alt="" className="w-3 h-3" />} {f.competition}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{f.venue === "H" ? "Casa" : "Fora"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "results" && (
            <Card className="p-4">
              {data.last.length === 0 ? <div className="text-center text-sm text-muted-foreground py-6">Sem resultados recentes.</div> : (
                <div className="divide-y divide-border">
                  {data.last.map((f) => (
                    <div key={f.id} className="py-3 flex items-center gap-3">
                      <div className="text-xs text-muted-foreground w-16 shrink-0">{formatDay(f.date)}</div>
                      <span className={`w-6 h-6 grid place-items-center rounded text-xs font-bold shrink-0 ${f.result === "V" ? "bg-success/20 text-success" : f.result === "D" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>{f.result}</span>
                      {f.opponentLogo && <img src={f.opponentLogo} alt="" className="w-7 h-7 object-contain shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <Link to="/team/$teamName" params={{ teamName: encodeURIComponent(f.opponent) }} className="font-medium hover:text-primary truncate block">{f.venue === "H" ? "vs " : "@ "}{f.opponent}</Link>
                        <div className="text-[11px] text-muted-foreground truncate">{f.competition}</div>
                      </div>
                      <div className="num font-bold tabular-nums">{f.gf} - {f.ga}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "standings" && (
            <Card className="p-4 overflow-x-auto">
              {data.standings.length === 0 ? <div className="text-center text-sm text-muted-foreground py-6">Classificação indisponível.</div> : (
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 w-8">#</th><th className="py-2">Time</th><th className="py-2 text-center">PJ</th><th className="py-2 text-center">V</th><th className="py-2 text-center">E</th><th className="py-2 text-center">D</th><th className="py-2 text-center">GP</th><th className="py-2 text-center">GC</th><th className="py-2 text-center">SG</th><th className="py-2 text-center font-bold">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.standings.map((s: typeof data.standings[number]) => {
                      const isThis = s.team === t?.name;
                      return (
                        <tr key={s.rank} className={`border-b border-border/50 ${isThis ? "bg-primary/10 font-semibold" : ""}`}>
                          <td className="py-2 num">{s.rank}</td>
                          <td className="py-2 flex items-center gap-2">{s.teamLogo && <img src={s.teamLogo} alt="" className="w-4 h-4" />} <Link to="/team/$teamName" params={{ teamName: encodeURIComponent(s.team) }} className="hover:text-primary truncate">{s.team}</Link></td>
                          <td className="py-2 text-center num">{s.played}</td><td className="py-2 text-center num">{s.win}</td><td className="py-2 text-center num">{s.draw}</td><td className="py-2 text-center num">{s.lose}</td><td className="py-2 text-center num">{s.gf}</td><td className="py-2 text-center num">{s.ga}</td><td className="py-2 text-center num">{s.gd}</td><td className="py-2 text-center num font-bold">{s.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {tab === "squad" && (
            <Card className="p-4">
              {data.squad.length === 0 ? <div className="text-center text-sm text-muted-foreground py-6">Elenco indisponível.</div> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {data.squad.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      {p.photo ? <img src={p.photo} alt={p.name} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-muted grid place-items-center text-xs">{p.number ?? "?"}</div>}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{p.position}{p.age ? ` • ${p.age} anos` : ""}{p.number ? ` • #${p.number}` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "stats" && (
            <div className="grid md:grid-cols-2 gap-4">
              {data.stats ? (
                <>
                  <Card className="p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">Temporada {data.league?.season}</h2>
                    <dl className="text-sm space-y-2">
                      <div className="flex justify-between"><dt className="text-muted-foreground">Jogos disputados</dt><dd className="num font-semibold">{data.stats.played}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">Vitórias / Empates / Derrotas</dt><dd className="num font-semibold">{data.stats.wins} / {data.stats.draws} / {data.stats.losses}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">Gols pró / contra</dt><dd className="num font-semibold">{data.stats.gf} / {data.stats.ga}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">Média gols pró</dt><dd className="num font-semibold">{data.stats.avgGoalsScored}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">Média gols contra</dt><dd className="num font-semibold">{data.stats.avgGoalsConceded}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">Jogos sem sofrer</dt><dd className="num font-semibold">{data.stats.cleanSheets}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">Não marcou</dt><dd className="num font-semibold">{data.stats.failedToScore}</dd></div>
                      {data.stats.biggestWin && <div className="flex justify-between"><dt className="text-muted-foreground">Maior vitória</dt><dd className="font-semibold">{data.stats.biggestWin}</dd></div>}
                      {data.stats.biggestLose && <div className="flex justify-between"><dt className="text-muted-foreground">Maior derrota</dt><dd className="font-semibold">{data.stats.biggestLose}</dd></div>}
                    </dl>
                  </Card>
                </>
              ) : <Card className="p-4 text-sm text-muted-foreground">Estatísticas indisponíveis.</Card>}

              {data.topScorers.length > 0 && (
                <Card className="p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">Artilheiros / assistentes</h2>
                  <ul className="space-y-2">
                    {data.topScorers.map((p, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        {p.photo && <img src={p.photo} alt="" className="w-8 h-8 rounded-full object-cover" />}
                        <div className="flex-1 min-w-0 truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground shrink-0 num">⚽ {p.goals} • 🎯 {p.assists} • {p.appearances}j</div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {tab === "transfers" && (
            <Card className="p-4">
              {data.transfers.length === 0 ? <div className="text-center text-sm text-muted-foreground py-6">Sem transferências recentes.</div> : (
                <div className="divide-y divide-border">
                  {data.transfers.map((tr, i) => (
                    <div key={i} className="py-2 flex items-center gap-3 text-sm">
                      <div className="text-xs text-muted-foreground w-20 shrink-0">{tr.date ? formatDay(tr.date) : "—"}</div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{tr.type}</Badge>
                      <div className="flex-1 min-w-0 truncate">{tr.player}</div>
                      <div className="text-xs text-muted-foreground shrink-0 truncate hidden sm:block">{tr.from ?? "—"} → {tr.to ?? "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "trophies" && (
            <Card className="p-4">
              {data.trophies.length === 0 ? <div className="text-center text-sm text-muted-foreground py-6">Sem títulos registrados.</div> : (
                <div className="divide-y divide-border">
                  {data.trophies.map((tr, i) => (
                    <div key={i} className="py-2 flex items-center gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{tr.league}</div>
                        <div className="text-[11px] text-muted-foreground">{tr.country} • {tr.season}</div>
                      </div>
                      <Badge variant={tr.place === "1" || /winner|champion/i.test(tr.place) ? "default" : "outline"} className="text-[10px]">{tr.place}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
