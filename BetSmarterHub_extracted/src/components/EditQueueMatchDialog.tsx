import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { fetchBookmakerOdds } from "@/lib/server-fns/single-dutch.functions";

interface Props {
  matchId: string;
  sportKey: string;
  home: string;
  away: string;
  currentOdds: { home: number; draw: number; away: number };
  onApply: (odds: { home: number; draw: number; away: number }, bookmaker?: string) => void;
  trigger?: React.ReactNode;
}

interface Row { bookmaker: string; home: number | null; draw: number | null; away: number | null }

export function EditQueueMatchDialog({ matchId, sportKey, home, away, currentOdds, onApply, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [info, setInfo] = useState<{ home: string; away: string; league: string; commence_time: string; reason: string } | null>(null);
  const fetchFn = useServerFn(fetchBookmakerOdds);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchFn({ data: { matchId, sportKey } });
        if (cancel) return;
        setRows(res.rows);
        setInfo({ home: res.home || home, away: res.away || away, league: res.league, commence_time: res.commence_time, reason: res.debug?.reason || "" });
      } catch (e) {
        if (!cancel) setInfo({ home, away, league: "", commence_time: "", reason: (e as Error).message });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, matchId, sportKey]);

  const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; } };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="contents">
        {trigger ?? <Button size="sm" variant="outline"><Pencil className="w-3.5 h-3.5 mr-1" />Editar</Button>}
      </button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Odds do jogo — {home} x {away}</DialogTitle>
        </DialogHeader>

        {info && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {info.league && <div><strong>{info.league}</strong></div>}
            {info.commence_time && <div>🕒 {fmtTime(info.commence_time)}</div>}
            {info.reason && <div className="italic">{info.reason}</div>}
          </div>
        )}

        <div className="mt-2 max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Buscando odds das casas...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma casa de aposta disponível para este jogo.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">Casa</th>
                  <th className="text-center py-2 px-2">1 ({info?.home || home})</th>
                  <th className="text-center py-2 px-2">X</th>
                  <th className="text-center py-2 px-2">2 ({info?.away || away})</th>
                  <th className="text-right py-2 px-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isCurrent = (r.home ?? 0) === currentOdds.home && (r.draw ?? 0) === currentOdds.draw && (r.away ?? 0) === currentOdds.away;
                  return (
                    <tr key={i} className={`border-b border-border/50 hover:bg-accent/50 ${isCurrent ? "bg-primary/10" : ""}`}>
                      <td className="py-2 px-2 font-medium">{r.bookmaker}</td>
                      <td className="text-center num py-2 px-2">{r.home?.toFixed(2) ?? "—"}</td>
                      <td className="text-center num py-2 px-2">{r.draw?.toFixed(2) ?? "—"}</td>
                      <td className="text-center num py-2 px-2">{r.away?.toFixed(2) ?? "—"}</td>
                      <td className="text-right py-2 px-2">
                        <Button
                          size="sm"
                          variant={isCurrent ? "secondary" : "default"}
                          disabled={!r.home && !r.draw && !r.away}
                          onClick={() => {
                            onApply({ home: r.home ?? 0, draw: r.draw ?? 0, away: r.away ?? 0 }, r.bookmaker);
                            setOpen(false);
                          }}
                        >
                          {isCurrent ? "Atual" : "Usar"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
