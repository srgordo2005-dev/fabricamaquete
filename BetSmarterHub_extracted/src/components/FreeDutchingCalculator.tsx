import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calculator, Trash2, Copy, Share2, TrendingUp, Search, Inbox } from "lucide-react";
import { calculateDutching } from "@/lib/dutching";
import { TeamJersey } from "@/components/TeamJersey";
import { MatchSearchDialog, type FoundMatch } from "@/components/MatchSearchDialog";
import { toast } from "sonner";

type OutcomeKey = "1" | "X" | "2" | "BB";
type MatchOutcome = "1" | "X" | "2";

interface Row {
  id: string;
  label: string;
  odds: string;
  outcomes: OutcomeKey[];
}

export interface CalcMatchRow {
  matchId: string;
  home: string;
  away: string;
  league?: string;
  time?: string;
  odds: { home: number; draw: number; away: number };
}

const INITIAL_FREE_ROWS = 6;

export interface QueueItemLite {
  key: string;
  home: string;
  away: string;
  odds?: { home: number; draw: number; away: number };
}

const newRow = (label = ""): Row => ({ id: crypto.randomUUID(), label, odds: "", outcomes: [] });

interface Props {
  matchRows?: CalcMatchRow[];
  onRemoveMatch?: (matchId: string) => void;
  onAddMatch?: (m: FoundMatch) => void;
  queue?: QueueItemLite[];
  onPickFromQueue?: (key: string) => void;
  onRemoveFromQueue?: (key: string) => void;
}

export function FreeDutchingCalculator({ matchRows = [], onRemoveMatch, onAddMatch, queue = [], onPickFromQueue, onRemoveFromQueue }: Props) {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: INITIAL_FREE_ROWS }, (_, i) => newRow(`Opção ${i + 1}`)));
  const [mode, setMode] = useState<"stake" | "profit">("stake");
  const [stake, setStake] = useState(100);
  const [targetProfit, setTargetProfit] = useState(20);

  // Outcome chosen per match (default: Casa)
  const [matchOutcomes, setMatchOutcomes] = useState<Record<string, MatchOutcome>>({});
  useEffect(() => {
    setMatchOutcomes((prev) => {
      const next = { ...prev };
      for (const m of matchRows) if (!next[m.matchId]) next[m.matchId] = "1";
      // cleanup removed ones
      for (const k of Object.keys(next)) if (!matchRows.some((m) => m.matchId === k)) delete next[k];
      return next;
    });
  }, [matchRows]);

  const matchSelections = useMemo(() =>
    matchRows.map((m) => {
      const oc = matchOutcomes[m.matchId] ?? "1";
      const odds = oc === "1" ? m.odds.home : oc === "X" ? m.odds.draw : m.odds.away;
      const teamLabel = oc === "1" ? m.home : oc === "X" ? "Empate" : m.away;
      return {
        id: `match-${m.matchId}`,
        label: `${m.home} x ${m.away} · ${oc} (${teamLabel})`,
        bookmaker: "Real",
        odds: Number(odds) || 0,
        outcome: oc,
        match: m,
      };
    }), [matchRows, matchOutcomes]);

  const freeSelections = useMemo(() =>
    rows
      .map((r, i) => ({
        id: r.id,
        label: r.label.trim() || `Opção ${i + 1}`,
        bookmaker: "Manual",
        odds: Number(r.odds),
      }))
      .filter((s) => s.odds >= 1.01), [rows]);

  const allSelections = useMemo(() => {
    const m = matchSelections.filter((s) => s.odds >= 1.01).map((s) => ({ id: s.id, label: s.label, bookmaker: s.bookmaker, odds: s.odds }));
    return [...m, ...freeSelections];
  }, [matchSelections, freeSelections]);

  const dutch = useMemo(() => {
    if (allSelections.length < 2) return null;
    let effectiveStake = stake;
    if (mode === "profit" && targetProfit > 0) {
      const invSum = allSelections.reduce((a, s) => a + 1 / s.odds, 0);
      const N = allSelections.length;
      if (N - invSum > 0) effectiveStake = (targetProfit * invSum) / (N - invSum);
    }
    return calculateDutching(allSelections.map((s) => ({ label: s.label, bookmaker: s.bookmaker, odds: s.odds })), effectiveStake);
  }, [allSelections, stake, mode, targetProfit]);

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((p) => [...p, newRow(`Opção ${p.length + 1}`)]);
  const removeRow = (id: string) => setRows((p) => p.length <= 1 ? p : p.filter((r) => r.id !== id));

  // Preencher uma linha a partir de um jogo (fila ou busca) — default: vencedor casa (1)
  const fillRowFromMatch = (
    rowId: string,
    m: { home: string; away: string; odds?: { home: number; draw: number; away: number } }
  ) => {
    updateRow(rowId, {
      label: `${m.home} x ${m.away} · 1 (${m.home})`,
      odds: m.odds && m.odds.home > 0 ? m.odds.home.toFixed(2) : "",
    });
    toast.success(`Linha preenchida: ${m.home} x ${m.away}`);
  };

  // Detecta linhas livres com a MESMA odd (placar igual) — avisa e marca em vermelho
  const duplicateOdds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = Number(r.odds);
      if (v >= 1.01) counts.set(v.toFixed(2), (counts.get(v.toFixed(2)) ?? 0) + 1);
    }
    return new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([k]) => k));
  }, [rows]);
  const lastWarnedRef = (globalThis as any).__lastDupWarn ?? { current: "" };
  (globalThis as any).__lastDupWarn = lastWarnedRef;
  useEffect(() => {
    const key = Array.from(duplicateOdds).sort().join(",");
    if (key && key !== lastWarnedRef.current) {
      lastWarnedRef.current = key;
      toast.warning(`⚠️ Linhas com odds iguais (${key}) — verifique se é proposital.`);
    } else if (!key) {
      lastWarnedRef.current = "";
    }
  }, [duplicateOdds]);
  const reset = () => setRows(Array.from({ length: INITIAL_FREE_ROWS }, (_, i) => newRow(`Opção ${i + 1}`)));

  const buildShareText = () => {
    if (!dutch) return "";
    const lines: string[] = [];
    lines.push("🧮 *Calculadora Dutching*");
    lines.push(`💰 Investimento: R$ ${dutch.totalStake.toFixed(2)}`);
    lines.push(`🎯 Lucro: R$ ${dutch.profit.toFixed(2)}  (${dutch.marginPct >= 0 ? "+" : ""}${dutch.marginPct.toFixed(2)}%)`);
    lines.push(`📥 Retorno garantido: R$ ${dutch.guaranteedReturn.toFixed(2)}`);
    lines.push("");
    let n = 1;
    for (const s of matchSelections) {
      const sel = dutch.selections.find((d) => d.label === s.label);
      if (!sel) continue;
      lines.push(`${n}. [${s.outcome}] ${s.match.home} x ${s.match.away}`);
      lines.push(`   Odd: ${sel.odds.toFixed(2)} • Stake: R$ ${sel.stake.toFixed(2)} → R$ ${sel.payout.toFixed(2)}`);
      n++;
    }
    rows.forEach((r, i) => {
      const fallback = r.label.trim() || `Opção ${i + 1}`;
      const sel = dutch.selections.find((d) => d.label === fallback);
      if (!sel) return;
      const tags = r.outcomes.length > 0 ? ` [${r.outcomes.join("/")}]` : "";
      lines.push(`${n}. ${fallback}${tags}`);
      lines.push(`   Odd: ${sel.odds.toFixed(2)} • Stake: R$ ${sel.stake.toFixed(2)} → R$ ${sel.payout.toFixed(2)}`);
      n++;
    });
    return lines.join("\n");
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (!text) { toast.error("Adicione pelo menos 2 odds válidas"); return; }
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ title: "Calculadora Dutching", text });
        return;
      }
    } catch { /* fallback */ }
    await navigator.clipboard.writeText(text);
    toast.success("Calculadora copiada — cole onde quiser compartilhar");
  };

  const matchOutcomeColor = (oc: MatchOutcome, active: boolean) => {
    if (!active) return "bg-muted text-muted-foreground hover:bg-accent";
    if (oc === "1") return "bg-success text-success-foreground";
    if (oc === "X") return "bg-warning text-warning-foreground";
    return "bg-destructive text-destructive-foreground";
  };

  return (
    <Card className="card-elev p-5 mt-6 border-primary/30">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" /> Calculadora de Dutching
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleShare} disabled={!dutch}>
            <Share2 className="w-3.5 h-3.5 mr-1" /> Compartilhar
          </Button>
        </div>
      </div>

      {/* Modo + lucro fixo no topo */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button type="button" onClick={() => setMode("stake")}
            className={`px-3 py-2 text-xs font-bold ${mode === "stake" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            💰 Investimento
          </button>
          <button type="button" onClick={() => setMode("profit")}
            className={`px-3 py-2 text-xs font-bold ${mode === "profit" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            🎯 Lucro fixo
          </button>
        </div>
        {mode === "stake" ? (
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <span className="px-3 py-2 bg-muted text-sm font-semibold">R$</span>
            <Input type="number" min={1} value={stake}
              onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 0))}
              className="num border-0 rounded-none w-32 text-base" />
          </div>
        ) : (
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <span className="px-3 py-2 bg-muted text-sm font-semibold">Σ Lucro R$</span>
            <Input type="number" min={1} value={targetProfit}
              onChange={(e) => setTargetProfit(Math.max(1, Number(e.target.value) || 0))}
              className="num border-0 rounded-none w-32 text-base" />
          </div>
        )}
        <div className="flex items-center gap-2 text-xs ml-auto flex-wrap p-2 rounded-md border border-primary/30 bg-primary/5">
          <span className="inline-flex items-center gap-1 font-semibold">
            <TrendingUp className="w-4 h-4 text-success" /> Lucro:
          </span>
          <Badge className={dutch && dutch.profit >= 0 ? "bg-success text-success-foreground num text-sm" : dutch ? "bg-destructive text-destructive-foreground num text-sm" : "bg-muted text-muted-foreground num text-sm"}>
            R$ {dutch ? dutch.profit.toFixed(2) : "0,00"}
          </Badge>
          <span>Retorno:</span>
          <Badge variant="secondary" className="num">R$ {dutch ? dutch.guaranteedReturn.toFixed(2) : "0,00"}</Badge>
          <span>Margem:</span>
          <Badge variant={dutch?.isArb ? "default" : "outline"} className="num">
            {dutch ? `${dutch.marginPct >= 0 ? "+" : ""}${dutch.marginPct.toFixed(2)}%` : "—"}
          </Badge>
        </div>
      </div>

      {matchRows.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-bold text-primary">
            🎯 Jogos na calculadora
          </div>
          {matchRows.map((m, idx) => {
            const oc = matchOutcomes[m.matchId] ?? "1";
            const sel = dutch?.selections.find((d) => d.label === `${m.home} x ${m.away} · ${oc} (${oc === "1" ? m.home : oc === "X" ? "Empate" : m.away})`);
            return (
              <div key={m.matchId} className="flex items-center gap-2 flex-wrap p-2 rounded-md border border-primary/25 bg-primary/5">
                <span className="num font-bold text-sm w-6 text-center text-muted-foreground">{idx + 1}.</span>
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <TeamJersey team={m.home} size={20} />
                  <span className="text-sm font-semibold truncate">{m.home}</span>
                  <span className="text-xs text-muted-foreground">x</span>
                  <TeamJersey team={m.away} size={20} />
                  <span className="text-sm font-semibold truncate">{m.away}</span>
                  {m.league && <Badge variant="outline" className="text-[10px]">{m.league}</Badge>}
                  {m.time && <span className="text-[11px] text-muted-foreground">🕒 {m.time}</span>}
                </div>
                <div className="inline-flex rounded-md border border-border overflow-hidden">
                  {(["1", "X", "2"] as MatchOutcome[]).map((option) => {
                    const odd = option === "1" ? m.odds.home : option === "X" ? m.odds.draw : m.odds.away;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setMatchOutcomes((prev) => ({ ...prev, [m.matchId]: option }))}
                        className={`px-2.5 py-2 text-xs font-bold ${matchOutcomeColor(option, oc === option)}`}
                        title={`Usar odd ${odd.toFixed(2)}`}
                      >
                        {option} {odd > 0 ? odd.toFixed(2) : "-"}
                      </button>
                    );
                  })}
                </div>
                <Badge variant="secondary" className="num">R$ {sel ? sel.stake.toFixed(2) : "0,00"}</Badge>
                <Badge variant="outline" className="num">→ R$ {sel ? sel.payout.toFixed(2) : "0,00"}</Badge>
                <Button size="sm" variant="ghost" onClick={() => onRemoveMatch?.(m.matchId)} title="Remover jogo da calculadora">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Linhas livres (manual) — sempre disponíveis */}
      <>
          <div className="flex items-center justify-between mb-2 mt-1 flex-wrap gap-2">
            <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
              ✏️ Opções livres (digite as odds)
            </div>
            {onAddMatch && (
              <MatchSearchDialog
                onPick={onAddMatch}
                excludeIds={matchRows.map((m) => m.matchId)}
                trigger={
                  <Button size="sm" variant="outline">
                    <Search className="w-3.5 h-3.5 mr-1" /> Adicionar jogo
                  </Button>
                }
              />
            )}
          </div>
          <div className="space-y-2">
            {rows.map((r, idx) => {
              const fallbackLabel = r.label.trim() || `Opção ${idx + 1}`;
              const sel = dutch?.selections.find((d) => d.label === fallbackLabel);
              const oddsValid = Number(r.odds) >= 1.01;
              const oddKey = oddsValid ? Number(r.odds).toFixed(2) : "";
              const isDup = oddKey && duplicateOdds.has(oddKey);
              return (
                <div key={r.id} className={`flex items-center gap-2 flex-wrap p-2 rounded-md border ${isDup ? "border-destructive bg-destructive/10" : "border-border/50 bg-muted/20"}`}>
                  <span className="num font-bold text-sm w-6 text-center text-muted-foreground">{idx + 1}.</span>
                  <Input value={r.label} placeholder={`Opção ${idx + 1}`}
                    onChange={(e) => updateRow(r.id, { label: e.target.value })}
                    className="h-9 flex-1 min-w-[120px]" />

                  <Input type="number" step="0.01" min="1.01" value={r.odds} placeholder="Odd"
                    onChange={(e) => updateRow(r.id, { odds: e.target.value })}
                    className={`h-9 w-20 num ${isDup ? "border-destructive" : (!oddsValid && r.odds ? "border-destructive/60" : "")}`} />
                  {isDup && <span className="text-[10px] font-bold text-destructive">odd repetida</span>}
                  <Badge variant="secondary" className="num">R$ {sel ? sel.stake.toFixed(2) : "0,00"}</Badge>
                  <button
                    onClick={() => {
                      if (!sel) return;
                      navigator.clipboard.writeText(sel.stake.toFixed(2));
                      toast.success(`Copiado: R$ ${sel.stake.toFixed(2)}`);
                    }}
                    disabled={!sel}
                    className="text-primary hover:underline text-[11px] inline-flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
                  >
                    <Copy className="w-3 h-3" /> copiar
                  </button>
                  <Badge variant="outline" className="num">→ R$ {sel ? sel.payout.toFixed(2) : "0,00"}</Badge>
                  <MatchSearchDialog
                    onPick={(m) => fillRowFromMatch(r.id, m)}
                    trigger={
                      <Button size="sm" variant="outline" className="h-9" title="Buscar jogo por data/nome para esta linha">
                        <Search className="w-3.5 h-3.5 mr-1" /> Buscar
                      </Button>
                    }
                  />
                  {queue.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 border-warning text-warning hover:bg-warning/10"
                      title="Pegar o próximo jogo da fila e colocar nesta linha"
                      onClick={() => {
                        const q = queue[0];
                        if (!q) return;
                        fillRowFromMatch(r.id, q);
                        onPickFromQueue?.(q.key);
                      }}
                    >
                      <Inbox className="w-3.5 h-3.5 mr-1" /> Adicionar da fila ({queue.length})
                    </Button>
                  )}

                  <Button size="sm" variant="ghost" onClick={() => removeRow(r.id)} title="Excluir linha" disabled={rows.length <= 1}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-center">
            <Button size="sm" variant="outline" onClick={addRow}>
              + Adicionar linha
            </Button>
          </div>
        </>

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-3 px-5 py-3 bg-card/95 backdrop-blur border-t border-primary/30 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={reset}>↺ Restaurar {INITIAL_FREE_ROWS} linhas</Button>
        {allSelections.length < 2 && (
          <span className="text-[11px] text-muted-foreground ml-auto">Adicione pelo menos 2 odds válidas para calcular.</span>
        )}
      </div>
    </Card>
  );
}
