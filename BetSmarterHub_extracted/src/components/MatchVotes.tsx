import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Vote } from "lucide-react";

type VoteOption = "home" | "draw" | "away";

interface Counts { home: number; draw: number; away: number; total: number }

export function MatchVotes({ matchId, homeName, awayName }: { matchId: string; homeName: string; awayName: string }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ home: 0, draw: 0, away: 0, total: 0 });
  const [myVote, setMyVote] = useState<VoteOption | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const { data } = await supabase
      .from("match_vote_counts" as any)
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setCounts({ home: Number(d.home_votes) || 0, draw: Number(d.draw_votes) || 0, away: Number(d.away_votes) || 0, total: Number(d.total_votes) || 0 });
    } else {
      setCounts({ home: 0, draw: 0, away: 0, total: 0 });
    }
  };

  useEffect(() => {
    refresh();
    if (user) {
      supabase.from("match_votes").select("vote").eq("match_id", matchId).eq("user_id", user.id).maybeSingle()
        .then(({ data }) => setMyVote((data?.vote as VoteOption) || null));
    } else {
      setMyVote(null);
    }
    const ch = supabase
      .channel(`votes:${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_votes", filter: `match_id=eq.${matchId}` },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, user?.id]);

  const vote = async (v: VoteOption) => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("match_votes")
      .upsert({ match_id: matchId, user_id: user.id, vote: v }, { onConflict: "match_id,user_id" });
    setLoading(false);
    if (error) toast.error(error.message);
    else setMyVote(v);
  };

  const pct = (n: number) => counts.total > 0 ? Math.round((n / counts.total) * 100) : 0;
  const rows: { key: VoteOption; label: string; n: number; color: string }[] = [
    { key: "home", label: homeName, n: counts.home, color: "bg-success" },
    { key: "draw", label: "Empate", n: counts.draw, color: "bg-warning" },
    { key: "away", label: awayName, n: counts.away, color: "bg-destructive" },
  ];

  return (
    <Card className="card-elev p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
        <Vote className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Quem ganha?</h3>
        <span className="ml-auto text-xs text-muted-foreground num">{counts.total} voto{counts.total === 1 ? "" : "s"}</span>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className={`font-medium truncate ${myVote === r.key ? "text-primary" : ""}`}>
                {myVote === r.key && "✓ "}{r.label}
              </span>
              <span className="num text-muted-foreground shrink-0 ml-2">{pct(r.n)}% · {r.n}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${r.color} transition-all duration-500 ease-out`} style={{ width: `${pct(r.n)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {user ? (
        <div className="grid grid-cols-3 gap-1.5 mt-4">
          {rows.map((r) => (
            <Button key={r.key} size="sm" variant={myVote === r.key ? "default" : "outline"}
              disabled={loading} onClick={() => vote(r.key)} className="text-xs">
              {r.key === "home" ? "Casa" : r.key === "draw" ? "Empate" : "Fora"}
            </Button>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">Faça login para votar</p>
          <Link to="/auth"><Button size="sm" variant="outline">Entrar</Button></Link>
        </div>
      )}
    </Card>
  );
}
