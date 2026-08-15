import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Search, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface FoundMatch {
  matchId: string;
  sportKey: string;
  home: string;
  away: string;
  league: string;
  commence_time: string;
  odds: { home: number; draw: number; away: number };
}

interface Props {
  trigger?: React.ReactNode;
  onPick: (m: FoundMatch) => void;
  excludeIds?: string[];
}

export function MatchSearchDialog({ trigger, onPick, excludeIds = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FoundMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !date) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from("matches_cache")
        .select("id,sport_key,league,home,away,commence_time,best_home,best_draw,best_away")
        .gte("commence_time", start.toISOString())
        .lte("commence_time", end.toISOString())
        .order("commence_time", { ascending: true })
        .limit(500);
      if (cancelled) return;
      setItems(
        (data ?? []).map((r) => ({
          matchId: r.id,
          sportKey: r.sport_key,
          home: r.home,
          away: r.away,
          league: r.league,
          commence_time: r.commence_time,
          odds: { home: Number(r.best_home) || 0, draw: Number(r.best_draw) || 0, away: Number(r.best_away) || 0 },
        }))
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, date]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((m) => !excludeIds.includes(m.matchId))
      .filter((m) => !q || `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(q));
  }, [items, query, excludeIds]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar jogo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buscar jogo</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP", { locale: ptBR }) : "Escolher data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
            </PopoverContent>
          </Popover>
          <div className="flex items-center border border-border rounded-md overflow-hidden flex-1 min-w-[180px]">
            <Search className="w-4 h-4 mx-2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por time ou liga..." className="border-0 h-9" />
          </div>
        </div>
        <div className="max-h-[55vh] overflow-y-auto mt-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum jogo encontrado para esta data.</div>
          ) : (
            filtered.map((m) => (
              <button
                key={m.matchId}
                onClick={() => { onPick(m); setOpen(false); }}
                className="w-full text-left p-2 rounded-md border border-border hover:bg-accent transition-colors flex items-center gap-2 flex-wrap"
              >
                <div className="text-xs text-muted-foreground w-28 shrink-0">
                  {format(new Date(m.commence_time), "dd/MM HH:mm", { locale: ptBR })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{m.home} <span className="text-muted-foreground">x</span> {m.away}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.league}</div>
                </div>
                <div className="text-[11px] num text-muted-foreground">
                  {m.odds.home.toFixed(2)} / {m.odds.draw.toFixed(2)} / {m.odds.away.toFixed(2)}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
