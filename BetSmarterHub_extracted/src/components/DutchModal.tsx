import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Calculator, Copy, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { fetchBookmakerOdds, analyzeSingleMatch, type BookmakerOddsRow, type SingleDutchResult } from "@/lib/server-fns/single-dutch.functions";
import { calculateDutching } from "@/lib/dutching";


const CERC_KEY = "madureira_cercamento_selection";
interface CercSelection {
  matchId: string;
  sportKey: string;
  label: string;
  // Odds pré-preenchidas vindas do Dutching: aparecem automaticamente na calculadora
  preset?: { source: string; home: number; draw: number; away: number };
}
function loadCerc(): CercSelection[] { try { return JSON.parse(localStorage.getItem(CERC_KEY) || "[]"); } catch { return []; } }
function saveCerc(s: CercSelection[]) { localStorage.setItem(CERC_KEY, JSON.stringify(s)); }

interface DutchModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matchId: string;
  sportKey: string;
  home: string;
  away: string;
  league: string;
  commenceTime?: string; // ISO — passada do dashboard quando disponível
}

const OUTCOME_COLOR: Record<string, string> = {
  "1": "bg-success/20 text-success border-success/40",
  "X": "bg-warning/20 text-warning border-warning/40",
  "2": "bg-destructive/20 text-destructive border-destructive/40",
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DutchModal({ open, onOpenChange, matchId, sportKey, home, away, league, commenceTime }: DutchModalProps) {
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [rows, setRows] = useState<BookmakerOddsRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [oddsDebug, setOddsDebug] = useState<{ source: string; reason: string; bookmakerCount: number } | null>(null);
  const [manualHome, setManualHome] = useState<string>("");
  const [manualDraw, setManualDraw] = useState<string>("");
  const [manualAway, setManualAway] = useState<string>("");
  const [stake, setStake] = useState<number>(1000);
  const [analysis, setAnalysis] = useState<SingleDutchResult | null>(null);
  // ISO from API (preferred over the prop, since fetch returns canonical value)
  const [fetchedCommence, setFetchedCommence] = useState<string>("");

  // Reset & fetch when modal opens
  useEffect(() => {
    if (!open) return;
    setAnalysis(null); setError(null); setRows([]); setFetchedCommence(""); setOddsDebug(null);
    setManualHome(""); setManualDraw(""); setManualAway("");
    setLoadingOdds(true);
    fetchBookmakerOdds({ data: { matchId, sportKey } })
      .then((r) => { setRows(r.rows); setFetchedCommence(r.commence_time || ""); setOddsDebug(r.debug); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingOdds(false));
  }, [open, matchId, sportKey]);

  const runAnalysis = async () => {
    setLoadingAnalysis(true); setError(null);
    try {
      const manual = (manualHome || manualDraw || manualAway) ? {
        home: manualHome ? parseFloat(manualHome.replace(",", ".")) : null,
        draw: manualDraw ? parseFloat(manualDraw.replace(",", ".")) : null,
        away: manualAway ? parseFloat(manualAway.replace(",", ".")) : null,
      } : undefined;
      // Envia TUDO para a IA: times, liga, data/horário (ISO), odds e manual.
      const commence_time = fetchedCommence || commenceTime || "";
      const res = await analyzeSingleMatch({
        data: { matchId, sportKey, home, away, league, commence_time, rows, manual },
      });
      setAnalysis(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Dutching distribution across the ranked scenarios
  const dutch = useMemo(() => {
    if (!analysis) return null;
    const sels = analysis.scenarios
      .filter((s) => s.bestOdds > 1)
      .map((s) => ({ label: `${s.rank}º ${s.outcome}`, bookmaker: s.bestBookmaker, odds: s.bestOdds }));
    if (sels.length < 2) return null;
    return calculateDutching(sels, stake);
  }, [analysis, stake]);

  // Odds escolhidas pelo usuário: manuais têm prioridade, senão melhor de cada casa
  const chosenOdds = useMemo(() => {
    const mh = manualHome ? parseFloat(manualHome.replace(",", ".")) : NaN;
    const md = manualDraw ? parseFloat(manualDraw.replace(",", ".")) : NaN;
    const ma = manualAway ? parseFloat(manualAway.replace(",", ".")) : NaN;
    const bestFromRows = (key: "home" | "draw" | "away") => {
      let best = 0; let bk = "";
      for (const r of rows) {
        const v = r[key];
        if (typeof v === "number" && v > best) { best = v; bk = r.bookmaker; }
      }
      return { odds: best, bookmaker: bk };
    };
    const bH = bestFromRows("home"); const bD = bestFromRows("draw"); const bA = bestFromRows("away");
    const home = !isNaN(mh) && mh > 1 ? { odds: mh, bookmaker: "Manual" } : bH;
    const draw = !isNaN(md) && md > 1 ? { odds: md, bookmaker: "Manual" } : bD;
    const away = !isNaN(ma) && ma > 1 ? { odds: ma, bookmaker: "Manual" } : bA;
    return { home, draw, away };
  }, [manualHome, manualDraw, manualAway, rows]);

  const hasChosenOdds = chosenOdds.home.odds > 1 && chosenOdds.draw.odds > 1 && chosenOdds.away.odds > 1;

  // Dutching direto a partir das odds escolhidas (sem IA)
  const directDutch = useMemo(() => {
    if (!hasChosenOdds) return null;
    return calculateDutching(
      [
        { label: "1", bookmaker: chosenOdds.home.bookmaker, odds: chosenOdds.home.odds },
        { label: "X", bookmaker: chosenOdds.draw.bookmaker, odds: chosenOdds.draw.odds },
        { label: "2", bookmaker: chosenOdds.away.bookmaker, odds: chosenOdds.away.odds },
      ],
      stake,
    );
  }, [hasChosenOdds, chosenOdds, stake]);

  
  const handleQueueInCercamento = () => {
    if (!directDutch) { toast.error("Preencha/escolha as 3 odds"); return; }
    const cur = loadCerc();
    // Captura a fonte: "Manual" se qualquer odd foi digitada à mão, senão a melhor casa
    const sources = new Set([chosenOdds.home.bookmaker, chosenOdds.draw.bookmaker, chosenOdds.away.bookmaker].filter(Boolean));
    const source = sources.size === 1 ? [...sources][0] : (sources.has("Manual") ? "Manual + casas" : "Mix de casas");
    const preset = {
      source,
      home: chosenOdds.home.odds,
      draw: chosenOdds.draw.odds,
      away: chosenOdds.away.odds,
    };
    const existingIdx = cur.findIndex((m) => m.matchId === matchId);
    let next: CercSelection[];
    if (existingIdx >= 0) {
      // Atualiza as odds do jogo já enfileirado (sobrescreve preset)
      next = [...cur];
      next[existingIdx] = { ...next[existingIdx], preset };
      saveCerc(next);
      toast.success(`✓ Odds atualizadas no cercamento (${next.length}/4)`);
    } else {
      if (cur.length >= 4) { toast.error("Limite de 4 jogos no cercamento"); return; }
      next = [...cur, { matchId, sportKey, label: `${home} x ${away}`, preset }];
      saveCerc(next);
      toast.success(`✓ Adicionado ao cercamento com odds (${next.length}/4)`);
    }
    onOpenChange(false);
  };

  const copyValue = (v: string) => {
    navigator.clipboard.writeText(v).then(() => toast.success(`Copiado: ${v}`));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Dutching — {home} vs {away}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {league || "—"} · {(() => {
              const iso = fetchedCommence || commenceTime;
              if (!iso) return "horário indisponível";
              const d = new Date(iso);
              return isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " (Brasília)";
            })()}
          </DialogDescription>
        </DialogHeader>

        {/* ============ ODDS POR CASA ============ */}
        <section className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Odds por casa de aposta</h3>
            <div className="flex items-center gap-2">
              {oddsDebug && (
                <Badge variant="outline" className="text-[10px]">
                  Fonte: {oddsDebug.source}
                </Badge>
              )}
              <Button size="sm" variant="ghost" disabled={loadingOdds} onClick={() => {
                setLoadingOdds(true);
                fetchBookmakerOdds({ data: { matchId, sportKey } })
                  .then((r) => { setRows(r.rows); setOddsDebug(r.debug); })
                  .catch((e) => setError((e as Error).message))
                  .finally(() => setLoadingOdds(false));
              }}>
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOdds ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {loadingOdds ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <div className="text-xs p-3 border border-dashed border-warning/40 bg-warning/5 rounded space-y-1">
              <p className="font-semibold text-warning">⚠ Nenhuma odd disponível das APIs</p>
              <p className="text-muted-foreground">
                <span className="font-medium">Motivo:</span> {oddsDebug?.reason || "API não retornou dados para este jogo."}
              </p>
              <p className="text-muted-foreground">
                Isso geralmente acontece em ligas regionais/menores que as APIs gratuitas não cobrem. Use o modo manual abaixo para digitar as odds direto da sua casa preferida (Bet365, Betano, Sportingbet, etc.).
              </p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Casa</th>
                    <th className="text-right px-3 py-2 font-semibold">Casa (1)</th>
                    <th className="text-right px-3 py-2 font-semibold">Empate (X)</th>
                    <th className="text-right px-3 py-2 font-semibold">Fora (2)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-muted/20" : ""}>
                      <td className="px-3 py-1.5 font-medium">{r.bookmaker}</td>
                      <td className="px-3 py-1.5 text-right num">{r.home?.toFixed(2) ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right num">{r.draw?.toFixed(2) ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right num">{r.away?.toFixed(2) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ============ MANUAL OVERRIDE ============ */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Odds manuais (opcional)</h3>
          <p className="text-[11px] text-muted-foreground">
            Preencha para ignorar/complementar as odds acima e enviar para a calculadora e IA.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Casa (1)</label>
              <Input inputMode="decimal" placeholder="ex: 2.20" value={manualHome} onChange={(e) => setManualHome(e.target.value)} className="num" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Empate (X)</label>
              <Input inputMode="decimal" placeholder="ex: 3.40" value={manualDraw} onChange={(e) => setManualDraw(e.target.value)} className="num" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Fora (2)</label>
              <Input inputMode="decimal" placeholder="ex: 3.10" value={manualAway} onChange={(e) => setManualAway(e.target.value)} className="num" />
            </div>
          </div>
        </section>

        {/* ============ INVESTIMENTO + RUN ============ */}
        <section className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Investimento (R$)</label>
            <Input
              type="number" min={1} value={stake}
              onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 0))}
              className="num text-lg font-bold"
            />
          </div>
          {hasChosenOdds ? (
            <Button onClick={handleQueueInCercamento} className="grad-neon text-primary-foreground font-semibold">
              <Save className="w-4 h-4 mr-2" />
              Adicionar à Calculadora (Cercamento)
            </Button>
          ) : (
            <Button onClick={runAnalysis} disabled={loadingAnalysis || rows.length === 0} className="grad-neon text-primary-foreground font-semibold">
              <Sparkles className="w-4 h-4 mr-2" />
              {loadingAnalysis ? "Analisando..." : "Analisar com IA"}
            </Button>
          )}
        </section>

        {/* ============ PREVIEW DUTCHING DIRETO (odds escolhidas) ============ */}
        {directDutch && hasChosenOdds && (
          <section className="space-y-2 p-3 rounded-md border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Dutching com odds escolhidas
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span>Lucro: <Badge className={directDutch.profit >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>R$ {fmtBRL(directDutch.profit)}</Badge></span>
                <span>Retorno: <Badge variant="secondary">R$ {fmtBRL(directDutch.guaranteedReturn)}</Badge></span>
                <span>Margem: <Badge variant={directDutch.isArb ? "default" : "outline"}>{directDutch.marginPct >= 0 ? "+" : ""}{directDutch.marginPct.toFixed(2)}%</Badge></span>
              </div>
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Resultado</th>
                    <th className="px-2 py-1.5 text-left">Casa</th>
                    <th className="px-2 py-1.5 text-right">Odd</th>
                    <th className="px-2 py-1.5 text-right">Stake</th>
                    <th className="px-2 py-1.5 text-right">Retorno</th>
                  </tr>
                </thead>
                <tbody>
                  {directDutch.selections.map((s) => (
                    <tr key={s.label} className="border-t">
                      <td className="px-2 py-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${OUTCOME_COLOR[s.label]}`}>{s.label}</span>
                        <span className="ml-2">{s.label === "1" ? home : s.label === "2" ? away : "Empate"}</span>
                      </td>
                      <td className="px-2 py-1.5">{s.bookmaker}</td>
                      <td className="px-2 py-1.5 text-right num font-bold">{s.odds.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right num">
                        <Badge variant="secondary">R$ {fmtBRL(s.stake)}</Badge>
                        <button onClick={() => copyValue(fmtBRL(s.stake))} className="ml-1 text-primary"><Copy className="w-3 h-3 inline" /></button>
                      </td>
                      <td className="px-2 py-1.5 text-right num">R$ {fmtBRL(s.payout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {error && (
          <div className="p-3 rounded border border-destructive/40 bg-destructive/10 text-xs text-destructive">{error}</div>
        )}

        {/* ============ AI RANKED SCENARIOS + DUTCHING ============ */}
        {analysis && dutch && (
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Análise IA — Cenários ranqueados
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span>Lucro: <Badge className={dutch.profit >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>R$ {fmtBRL(dutch.profit)}</Badge></span>
                <span>Retorno: <Badge variant="secondary">R$ {fmtBRL(dutch.guaranteedReturn)}</Badge></span>
                <span>Margem: <Badge variant={dutch.isArb ? "default" : "outline"}>{dutch.marginPct >= 0 ? "+" : ""}{dutch.marginPct.toFixed(2)}%</Badge></span>
              </div>
            </div>

            {analysis.aiSummary && (
              <div className="p-3 rounded-md bg-primary/10 border border-primary/30 text-xs">
                <span className="font-bold text-primary">🧠 IA: </span>{analysis.aiSummary}
              </div>
            )}

            {/* Table — best at top, worst at bottom */}
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-foreground text-background">
                  <tr>
                    <th className="px-2 py-2 text-center w-10">#</th>
                    <th className="px-3 py-2 text-left">Cenário</th>
                    <th className="px-2 py-2 text-right">Odd</th>
                    <th className="px-2 py-2 text-right">Prob</th>
                    <th className="px-2 py-2 text-right">Investimento</th>
                    <th className="px-2 py-2 text-center w-12"></th>
                    <th className="px-2 py-2 text-right">Retorno</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.scenarios.map((s) => {
                    const sel = dutch.selections.find((d) => d.label === `${s.rank}º ${s.outcome}`);
                    const stakeStr = sel ? fmtBRL(sel.stake) : "—";
                    return (
                      <tr key={s.outcome} className="border-t">
                        <td className="px-2 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold border ${OUTCOME_COLOR[s.outcome]}`}>
                            {s.rank}º
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold">{s.outcomeLabel}</div>
                          <div className="text-[10px] text-muted-foreground">{s.reasoning}</div>
                          <div className="text-[10px] text-muted-foreground">via {s.bestBookmaker}</div>
                        </td>
                        <td className="px-2 py-2 text-right num font-bold">{s.bestOdds > 0 ? s.bestOdds.toFixed(2) : "—"}</td>
                        <td className="px-2 py-2 text-right num">{(s.prob * 100).toFixed(1)}%</td>
                        <td className="px-2 py-2 text-right">
                          <Badge variant="secondary" className="num">R$ {stakeStr}</Badge>
                        </td>
                        <td className="px-2 py-2 text-center">
                          {sel && (
                            <button onClick={() => copyValue(fmtBRL(sel.stake))} className="text-primary hover:underline text-[11px]">
                              <Copy className="w-3 h-3 inline" /> copiar
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Badge variant="outline" className="num">R$ {sel ? fmtBRL(sel.payout) : "—"}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-muted-foreground">
              💡 Distribuição calculada para que qualquer cenário que ocorrer retorne aproximadamente o mesmo valor.
              Topo = maior probabilidade (IA). Base = menos provável.
            </p>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
