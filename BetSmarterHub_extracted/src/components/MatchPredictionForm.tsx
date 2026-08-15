import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Target, Lock } from "lucide-react";

interface ExistingPred {
  id: string;
  home_score: number;
  away_score: number;
  result: string;
  xp_awarded: number;
}

export function MatchPredictionForm({
  matchId,
  commenceTime,
  homeName,
  awayName,
}: {
  matchId: string;
  commenceTime: string;
  homeName: string;
  awayName: string;
}) {
  const { user } = useAuth();
  const [existing, setExisting] = useState<ExistingPred | null>(null);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) { setExisting(null); return; }
    supabase
      .from("match_predictions")
      .select("id,home_score,away_score,result,xp_awarded")
      .eq("match_id", matchId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExisting(data as ExistingPred);
          setHome(String(data.home_score));
          setAway(String(data.away_score));
        }
      });
  }, [matchId, user?.id]);

  const kickoff = new Date(commenceTime).getTime();
  const locked = now >= kickoff;

  const submit = async () => {
    if (!user) return;
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0 || h > 99 || a > 99) {
      toast.error("Informe um placar válido (0–99)");
      return;
    }
    if (locked) { toast.error("Jogo já começou — palpites bloqueados"); return; }
    setSaving(true);
    const display =
      (user.user_metadata?.display_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email?.split("@")[0] ||
      "Anônimo";
    const avatar = (user.user_metadata?.avatar_url as string) || null;

    const payload = {
      match_id: matchId,
      user_id: user.id,
      display_name: display,
      avatar_url: avatar,
      home_score: h,
      away_score: a,
      result: "pending",
    };

    const { data, error } = existing
      ? await supabase
          .from("match_predictions")
          .update({ home_score: h, away_score: a })
          .eq("id", existing.id)
          .select("id,home_score,away_score,result,xp_awarded")
          .maybeSingle()
      : await supabase
          .from("match_predictions")
          .insert(payload)
          .select("id,home_score,away_score,result,xp_awarded")
          .maybeSingle();

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (data) setExisting(data as ExistingPred);
    toast.success(existing ? "Palpite atualizado!" : "Palpite registrado!");
  };

  if (!user) {
    return (
      <div className="rounded-lg border border-border/50 p-3 mb-2 bg-muted/20 text-center">
        <p className="text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1">
          <Target className="w-3 h-3" /> Faça login para dar seu palpite
        </p>
        <Link to="/auth"><Button size="sm" variant="outline">Entrar</Button></Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mb-2">
      <div className="flex items-center gap-2 mb-2">
        {locked ? <Lock className="w-3.5 h-3.5 text-muted-foreground" /> : <Target className="w-3.5 h-3.5 text-primary" />}
        <h4 className="text-xs font-bold uppercase tracking-wider">
          {locked ? "Palpites encerrados" : existing ? "Seu palpite" : "Dê seu palpite (placar)"}
        </h4>
        {existing && (
          <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            existing.result === "exact" ? "bg-success/20 text-success" :
            existing.result === "winner" ? "bg-primary/20 text-primary" :
            existing.result === "wrong" ? "bg-destructive/20 text-destructive" :
            "bg-muted text-muted-foreground"
          }`}>
            {existing.result === "exact" ? "🎯 Exato" :
             existing.result === "winner" ? "✅ Vencedor" :
             existing.result === "wrong" ? "❌ Errou" :
             "⏳ Aguardando"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] truncate flex-1 text-right">{homeName}</span>
        <Input
          type="number" min={0} max={99} value={home} onChange={(e) => setHome(e.target.value)}
          disabled={locked || saving}
          className="w-14 h-9 text-center font-bold num"
          placeholder="0"
        />
        <span className="text-muted-foreground">×</span>
        <Input
          type="number" min={0} max={99} value={away} onChange={(e) => setAway(e.target.value)}
          disabled={locked || saving}
          className="w-14 h-9 text-center font-bold num"
          placeholder="0"
        />
        <span className="text-[11px] truncate flex-1">{awayName}</span>
      </div>

      {!locked && (
        <Button size="sm" className="w-full mt-2" onClick={submit} disabled={saving || !home || !away}>
          {saving ? "Salvando..." : existing ? "Atualizar palpite" : "Enviar palpite"}
        </Button>
      )}
      {locked && !existing && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">Você não palpitou neste jogo</p>
      )}
    </div>
  );
}
