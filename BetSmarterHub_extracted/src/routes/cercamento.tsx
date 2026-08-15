import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { getMatches1X2, type MatchOdds1X2 } from "@/lib/server-fns/cercamento.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { FreeDutchingCalculator, type CalcMatchRow } from "@/components/FreeDutchingCalculator";
import { MatchSearchDialog, type FoundMatch } from "@/components/MatchSearchDialog";

export const Route = createFileRoute("/cercamento")({
  component: CercamentoPage,
});

interface SelectedMatch {
  key: string;
  matchId: string;
  sportKey: string;
  home: string;
  away: string;
  league?: string;
  odds: { home: number; draw: number; away: number };
}

const STORAGE_KEY = "madureira_cercamento_selection";
const QUEUE_KEY = "madureira_cercamento_queue";

function normalizeStoredMatches(items: SelectedMatch[]): SelectedMatch[] {
  const used = new Set<string>();
  return items.map((item) => {
    const baseKey = typeof item?.key === "string" && item.key.trim() ? item.key : newKey();
    const key = used.has(baseKey) ? newKey() : baseKey;
    used.add(key);
    return { ...item, key };
  });
}

function loadSelection(): SelectedMatch[] {
  try { return normalizeStoredMatches(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as SelectedMatch[]); } catch { return []; }
}
function saveSelection(s: SelectedMatch[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
function loadQueue(): SelectedMatch[] {
  try { return normalizeStoredMatches(JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as SelectedMatch[]); } catch { return []; }
}
function saveQueue(q: SelectedMatch[]) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
const newKey = () => (typeof crypto !== "undefined" ? crypto.randomUUID() : `k-${Date.now()}-${Math.random()}`);

function fmtDateTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function CercamentoPage() {
  const [queue, setQueue] = useState<SelectedMatch[]>([]);
  const [selected, setSelected] = useState<SelectedMatch[]>([]);
  const [previewMatches, setPreviewMatches] = useState<MatchOdds1X2[]>([]);

  useEffect(() => {
    const storedSelected = loadSelection();
    const storedQueue = loadQueue();
    setSelected(storedSelected);
    setQueue(storedQueue);
    saveSelection(storedSelected);
    saveQueue(storedQueue);
  }, []);

  // Hidrata times/horário/liga para os jogos selecionados
  useEffect(() => {
    if (selected.length === 0) { setPreviewMatches([]); return; }
    let cancelled = false;
    const req = selected.map((s) => ({ matchId: s.matchId, sportKey: s.sportKey }));
    getMatches1X2({ data: { matches: req } })
      .then((m) => { if (!cancelled) setPreviewMatches(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selected]);

  const fromFound = (m: FoundMatch): SelectedMatch => ({
    key: newKey(),
    matchId: m.matchId,
    sportKey: m.sportKey,
    home: m.home,
    away: m.away,
    odds: m.odds,
  });

  // ===== FILA =====
  const addToQueue = (m: FoundMatch) => {
    const next = [...queue, fromFound(m)];
    setQueue(next); saveQueue(next);
    toast.success(`📥 Na fila: ${m.home} x ${m.away}`);
  };
  const removeFromQueue = (key: string) => {
    const next = queue.filter((q) => q.key !== key);
    setQueue(next); saveQueue(next);
  };
  // Adicionar direto à calculadora (a partir do MatchSearchDialog dentro da calc)
  const addDirectlyToSelected = (m: FoundMatch) => {
    const next = [...selected, fromFound(m)];
    setSelected(next); saveSelection(next);
  };

  const removeMatch = (key: string) => {
    const next = selected.filter((s) => s.key !== key);
    setSelected(next); saveSelection(next);
  };

  // Linhas para a calculadora — uma por jogo selecionado, com chave única
  const calcMatchRows: CalcMatchRow[] = useMemo(() => selected.map((s) => {
    const data = previewMatches.find((p) => p.matchId === s.matchId);
    const safeOdds = s.odds ?? { home: 0, draw: 0, away: 0 };
    return {
      matchId: s.key,
      home: data?.home ?? s.home ?? "Casa",
      away: data?.away ?? s.away ?? "Fora",
      league: data?.league ?? s.league,
      time: data?.commence_time ? fmtDateTime(data.commence_time) : undefined,
      odds: {
        home: Number(safeOdds.home) || 0,
        draw: Number(safeOdds.draw) || 0,
        away: Number(safeOdds.away) || 0,
      },
    };
  }), [selected, previewMatches]);

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster richColors />
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">🎯 Cercamento Multi-Jogo</h1>
            <p className="text-sm text-muted-foreground">Coloque jogos na fila, envie pra calculadora e ajuste à vontade — sem IA.</p>
          </div>
          <Link to="/dashboard"><Button variant="outline" size="sm">+ Adicionar do Dashboard</Button></Link>
        </div>

        {/* FILA */}
        <Card className="card-elev p-4 mb-4 border-warning/40 bg-warning/5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-warning">📋 Fila de jogos ({queue.length})</h2>
            <MatchSearchDialog excludeIds={[]} onPick={addToQueue} trigger={<Button size="sm" variant="outline">🔍 Buscar jogo</Button>} />
          </div>
          {queue.length === 0 ? (
            <p className="text-xs text-muted-foreground">Fila vazia. Use 🔍 Buscar jogo. Você pode repetir o mesmo jogo várias vezes.</p>
          ) : (
            <div className="space-y-2">
              {queue.map((q) => (
                <div key={q.key} className="flex items-center justify-between gap-3 p-2 rounded-md border border-border bg-background/60 flex-wrap">
                  <span className="text-sm font-medium truncate flex-1 min-w-[140px]">{q.home} x {q.away}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeFromQueue(q.key)} title="Remover da fila">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* CALCULADORA SIMPLES — sem IA */}
        <FreeDutchingCalculator
          matchRows={calcMatchRows}
          onRemoveMatch={removeMatch}
          onAddMatch={addDirectlyToSelected}
          queue={queue.map((q) => ({ key: q.key, home: q.home, away: q.away, odds: q.odds }))}
          onPickFromQueue={removeFromQueue}
          onRemoveFromQueue={removeFromQueue}
        />
      </main>
      <ResponsibleFooter />
    </div>
  );
}
