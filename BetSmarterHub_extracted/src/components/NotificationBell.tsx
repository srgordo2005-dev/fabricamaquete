import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

type Notif = { id: string; type: string; title: string; body: string | null; data: Record<string, unknown>; read: boolean; created_at: string };

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const unread = items.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) { setItems([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      if (!cancelled) setItems((data ?? []) as Notif[]);
    })();

    const ch = supabase
      .channel(`notif:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        const n = p.new as Notif;
        setItems(prev => [n, ...prev].slice(0, 20));
        toast(n.title, { description: n.body ?? undefined });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  if (!user) return null;

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-accent/30 transition" aria-label="Notificações">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute top-0 right-0 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center px-1">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {unread > 0 && <button onClick={markAllRead} className="text-xs text-primary hover:underline">Marcar lidas</button>}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sem notificações ainda</p>
          ) : items.map(n => (
            <div key={n.id} className={`p-3 border-b last:border-b-0 text-sm ${!n.read ? "bg-primary/5" : ""}`}>
              <div className="font-semibold">{n.title}</div>
              {n.body && <div className="text-muted-foreground text-xs mt-0.5">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
