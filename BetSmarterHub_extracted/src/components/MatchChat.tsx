import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Send, Zap, MessageCircle } from "lucide-react";
import { MatchPredictionForm } from "@/components/MatchPredictionForm";

interface ChatMsg {
  id: string;
  match_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  message: string;
  created_at: string;
}

function buildQuick(home?: string, away?: string): string[] {
  const h = home?.trim() || "Casa";
  const a = away?.trim() || "Fora";
  return [
    `Vitória do ${h} 🏠`,
    `Vitória do ${a} ✈️`,
    "Empate 🤝",
    `${h} 2x1 ${a}`,
    `${a} 2x1 ${h}`,
    `${h} 1x0 ${a}`,
    `${a} 1x0 ${h}`,
    "0x0 🛡️",
    "GOL! 🥳",
    "Que jogo! ⚽",
  ];
}

export function MatchChat({ matchId, commenceTime, homeName, awayName }: { matchId: string; commenceTime?: string; homeName?: string; awayName?: string }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("match_chat")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => { if (active && data) setMsgs(data as ChatMsg[]); });

    const channel = supabase
      .channel(`chat:${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_chat", filter: `match_id=eq.${matchId}` },
        (payload) => setMsgs((prev) => [...prev.slice(-199), payload.new as ChatMsg]))
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [matchId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  const send = async (msg?: string) => {
    const m = (msg ?? text).trim();
    if (!m || !user || sending) return;
    if (m.length > 300) { toast.error("Máx 300 caracteres"); return; }
    setSending(true);
    const display = (user.user_metadata?.display_name as string) || (user.user_metadata?.name as string) || user.email?.split("@")[0] || "Anônimo";
    const avatar = (user.user_metadata?.avatar_url as string) || null;
    const { error } = await supabase.from("match_chat").insert({
      match_id: matchId, user_id: user.id, display_name: display, avatar_url: avatar, message: m,
    });
    setSending(false);
    if (error) toast.error(error.message);
    else if (!msg) setText("");
  };

  return (
    <Card className="card-elev p-4 flex flex-col h-[520px]">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
        <MessageCircle className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Chat ao vivo</h3>
        <span className="ml-auto text-xs text-muted-foreground">{msgs.length}/200</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        {msgs.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">Seja o primeiro a comentar! 💬</p>
        )}
        {msgs.map((m) => {
          const mine = user?.id === m.user_id;
          const initial = (m.display_name?.[0] || "?").toUpperCase();
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <div className="w-7 h-7 rounded-full bg-primary/20 grid place-items-center text-xs font-bold shrink-0 overflow-hidden ring-1 ring-primary/30">
                {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                {!mine && <div className="text-[10px] font-semibold opacity-70 mb-0.5">{m.display_name}</div>}
                <div className="break-words whitespace-pre-wrap">{m.message}</div>
                <div className={`text-[9px] opacity-60 mt-0.5 ${mine ? "text-right" : ""}`}>
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {commenceTime && homeName && awayName && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <MatchPredictionForm matchId={matchId} commenceTime={commenceTime} homeName={homeName} awayName={awayName} />
        </div>
      )}

      {user ? (
        <>
          <div className="flex gap-1 flex-wrap mt-2 pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground self-center mr-1"><Zap className="w-3 h-3 inline" /></span>
            {buildQuick(homeName, awayName).map((q) => (
              <button key={q} onClick={() => send(q)} disabled={sending}
                className="text-xs px-2 py-0.5 rounded-full border border-border/60 hover:bg-primary/10 hover:border-primary/40 transition-colors">
                {q}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 mt-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
              placeholder="Digite uma mensagem…" disabled={sending} />
            <Button type="submit" size="sm" disabled={sending || !text.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </>
      ) : (
        <div className="mt-3 pt-3 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground mb-2">Faça login para participar do chat</p>
          <Link to="/auth"><Button size="sm" variant="outline">Entrar</Button></Link>
        </div>
      )}
    </Card>
  );
}
