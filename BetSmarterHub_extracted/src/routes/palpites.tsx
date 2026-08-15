import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AccessGuard } from "@/components/AccessGuard";

export const Route = createFileRoute("/palpites")({
  component: () => <AccessGuard><PalpitesPage /></AccessGuard>,
});

interface MatchRow {
  id: string; league: string; home: string; away: string;
  commence_time: string; status_short: string | null;
  home_goals: number | null; away_goals: number | null;
}
interface PredRow {
  id: string; match_id: string;
  home_score: number; away_score: number;
  result: "exact" | "winner" | "wrong" | "pending";
  xp_awarded: number; created_at: string;
}

type Filter = "all" | "exact" | "winner" | "wrong" | "pending";

function PalpitesPage() {
  const { user } = useAuth();
  const { level, xp, badges } = useProfile();
  const [preds, setPreds] = useState<PredRow[]>([]);
  const [matches, setMatches] = useState<Record<string, MatchRow>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    if (!user) { setPreds([]); setLoading(false); return; }
    const { data: p } = await supabase
      .from("match_predictions").select("id,match_id,home_score,away_score,result,xp_awarded,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    const list = (p as PredRow[]) || [];
    setPreds(list);
    if (list.length) {
      const ids = [...new Set(list.map(x => x.match_id))];
      const { data: m } = await supabase.from("matches_cache")
        .select("id,league,home,away,commence_time,status_short,home_goals,away_goals")
        .in("id", ids);
      const map: Record<string, MatchRow> = {};
      for (const row of (m as MatchRow[]) || []) map[row.id] = row;
      setMatches(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => filter === "all" ? preds : preds.filter(p => p.result === filter), [preds, filter]);

  const counts = useMemo(() => ({
    all: preds.length,
    exact: preds.filter(p => p.result === "exact").length,
    winner: preds.filter(p => p.result === "winner").length,
    wrong: preds.filter(p => p.result === "wrong").length,
    pending: preds.filter(p => p.result === "pending").length,
  }), [preds]);

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster richColors />
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="text-primary" /> Meus Palpites</h1>
            <p className="text-muted-foreground text-sm">Histórico dos seus palpites. Para palpitar em um jogo, abra o chat do jogo.</p>
          </div>
          <Card className="card-elev px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Nível</span>
            <span className="text-2xl font-bold">{level}</span>
            <span className="text-xs text-muted-foreground">XP {xp}</span>
            <span className="text-xs text-muted-foreground">🏅 {badges.length}</span>
            <Link to="/profile"><Button size="sm" variant="outline">Perfil</Button></Link>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {([
            ["all", `Todos (${counts.all})`],
            ["exact", `🎯 Exato (${counts.exact})`],
            ["winner", `✅ Vencedor (${counts.winner})`],
            ["wrong", `❌ Errou (${counts.wrong})`],
            ["pending", `⏳ Aguardando (${counts.pending})`],
          ] as [Filter, string][]).map(([key, label]) => (
            <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
              {label}
            </Button>
          ))}
        </div>

        {loading && <p className="text-muted-foreground">Carregando…</p>}
        {!loading && preds.length === 0 && (
          <Card className="card-elev p-6 text-center text-muted-foreground">
            Você ainda não fez nenhum palpite. Abra o chat de um jogo para palpitar.
          </Card>
        )}
        {!loading && preds.length > 0 && filtered.length === 0 && (
          <Card className="card-elev p-6 text-center text-muted-foreground">Nenhum palpite nesse filtro.</Card>
        )}

        <div className="grid gap-2">
          {filtered.map(p => {
            const m = matches[p.match_id];
            const finished = m && ["FT", "AET", "PEN"].includes(m.status_short || "") && m.home_goals != null;
            const color = p.result === "exact" ? "text-success" : p.result === "winner" ? "text-primary" : p.result === "wrong" ? "text-destructive" : "text-muted-foreground";
            const icon = p.result === "exact" ? "🎯" : p.result === "winner" ? "✅" : p.result === "wrong" ? "❌" : "⏳";
            return (
              <Card key={p.id} className="card-elev p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <div className="text-xs text-muted-foreground">{m?.league ?? "—"}</div>
                  <div className="font-semibold text-sm">{m ? `${m.home} vs ${m.away}` : p.match_id}</div>
                  <div className="text-xs text-muted-foreground">{m ? new Date(m.commence_time).toLocaleString("pt-BR") : new Date(p.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Seu palpite</div>
                  <div className="font-mono font-bold">{p.home_score} x {p.away_score}</div>
                </div>
                {finished && (
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Final</div>
                    <div className="font-mono font-bold">{m.home_goals} x {m.away_goals}</div>
                  </div>
                )}
                <div className={`text-sm font-semibold ${color} min-w-[90px] text-right`}>
                  {icon} {p.result === "exact" ? "Exato" : p.result === "winner" ? "Vencedor" : p.result === "wrong" ? "Errou" : "Aguardando"}
                  {p.xp_awarded > 0 && <div className="text-[10px] text-muted-foreground">+{p.xp_awarded} XP</div>}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
      <ResponsibleFooter />
    </div>
  );
}
