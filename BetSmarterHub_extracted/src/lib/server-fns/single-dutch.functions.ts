import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getMatchOdds } from "./odds.functions";

// ============================================================
// SINGLE-MATCH DUTCH — fetch odds from all bookmakers + AI ranks
// the 1/X/2 outcomes from 1 (best) to N (worst).
// ============================================================

export interface BookmakerOddsRow {
  bookmaker: string;
  home: number | null;
  draw: number | null;
  away: number | null;
}

export interface RankedScenario {
  rank: number;             // 1 = melhor
  outcome: "1" | "X" | "2";
  outcomeLabel: string;     // "Casa: Flamengo", "Empate", ...
  bestOdds: number;         // melhor odd entre as casas
  bestBookmaker: string;
  prob: number;             // 0..1 normalized implied prob
  edgePct: number;          // (prob*odds - 1) * 100
  reasoning: string;        // motivo curto (IA ou fallback)
}

export interface SingleDutchResult {
  matchId: string;
  home: string;
  away: string;
  league: string;
  rows: BookmakerOddsRow[];
  scenarios: RankedScenario[];
  aiSummary: string;
  source: "api" | "manual";
}

// ---------- helpers ----------
function pickBest(
  rows: BookmakerOddsRow[],
  side: "home" | "draw" | "away",
): { price: number; bookmaker: string } {
  let best = 0;
  let bm = "—";
  for (const r of rows) {
    const v = r[side];
    if (typeof v === "number" && v > best) { best = v; bm = r.bookmaker; }
  }
  return { price: best, bookmaker: bm };
}

async function callOpenRouter(model: string, system: string, user: string, key: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://madureirabet.lovable.app",
      "X-Title": "MadureiraBet Single-Dutch",
    },
    body: JSON.stringify({
      model, temperature: 0.15, max_tokens: 600,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

// Format commence_time → pt-BR (Brasília)
function fmtCommence(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }) + " (Brasília)";
  } catch { return iso; }
}

// ---------- 1) FETCH all bookmaker rows ----------
export const fetchBookmakerOdds = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    matchId: z.string(),
    sportKey: z.string(),
  }).parse(d))
  .handler(async ({ data }): Promise<{
    home: string; away: string; league: string; commence_time: string;
    rows: BookmakerOddsRow[];
    debug: { source: string; reason: string; bookmakerCount: number };
  }> => {
    let source = "unknown";
    let reason = "";
    let odds: Awaited<ReturnType<typeof getMatchOdds>> | null = null;

    try {
      odds = await getMatchOdds({ data });
      source = data.matchId.startsWith("af_") || data.sportKey.startsWith("af_")
        ? "API-Football"
        : "The Odds API";
      console.log(`[fetchBookmakerOdds] ${source} returned ${odds.bookmakers.length} bookmakers for ${data.matchId}`);
    } catch (e) {
      reason = `Falha ao consultar a API de odds: ${(e as Error).message}`;
      console.error(`[fetchBookmakerOdds] ${reason}`);
      return {
        home: "", away: "", league: "", commence_time: "",
        rows: [],
        debug: { source: "erro", reason, bookmakerCount: 0 },
      };
    }

    const rows: BookmakerOddsRow[] = odds.bookmakers.map((bm) => {
      let h: number | null = null, d: number | null = null, a: number | null = null;
      for (const o of bm.markets.h2h ?? []) {
        if (o.name === odds!.home) h = o.price;
        else if (o.name === odds!.away) a = o.price;
        else if (o.name.toLowerCase().includes("draw")) d = o.price;
      }
      return { bookmaker: bm.bookmaker, home: h, draw: d, away: a };
    }).filter((r) => r.home || r.draw || r.away);

    if (rows.length === 0) {
      reason = odds.bookmakers.length === 0
        ? `${source} não retornou nenhuma casa de aposta para este jogo (mercado h2h indisponível em ligas pequenas/regionais).`
        : `${source} retornou ${odds.bookmakers.length} casa(s), mas nenhuma com mercado 1/X/2 reconhecido.`;
      console.warn(`[fetchBookmakerOdds] ${reason}`);
    } else {
      reason = `${rows.length} casa(s) com odds válidas via ${source}.`;
    }

    return {
      home: odds.home,
      away: odds.away,
      league: odds.league,
      commence_time: odds.commence_time,
      rows,
      debug: { source, reason, bookmakerCount: odds.bookmakers.length },
    };
  });

// ---------- 2) ANALYZE & RANK with AI ----------
export const analyzeSingleMatch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    matchId: z.string(),
    sportKey: z.string(),
    home: z.string().optional().default(""),
    away: z.string().optional().default(""),
    league: z.string().optional().default(""),
    commence_time: z.string().optional().default(""),
    rows: z.array(z.object({
      bookmaker: z.string(),
      home: z.number().nullable(),
      draw: z.number().nullable(),
      away: z.number().nullable(),
    })).default([]),
    manual: z.object({
      home: z.number().positive().nullable(),
      draw: z.number().positive().nullable(),
      away: z.number().positive().nullable(),
    }).optional(),
  }).parse(d))
  .handler(async ({ data }): Promise<SingleDutchResult> => {
    // ---------- Hydrate missing match metadata defensively ----------
    // Garante que a IA SEMPRE receba: liga, mandante, visitante, data/horário.
    let { home, away, league, commence_time } = data;
    let rows = data.rows;
    const needsHydration = !home || !away || !league || !commence_time || rows.length === 0;
    if (needsHydration) {
      try {
        const odds = await getMatchOdds({ data: { matchId: data.matchId, sportKey: data.sportKey } });
        home = home || odds.home;
        away = away || odds.away;
        league = league || odds.league;
        commence_time = commence_time || odds.commence_time;
        if (rows.length === 0) {
          rows = odds.bookmakers.map((bm) => {
            let h: number | null = null, dr: number | null = null, a: number | null = null;
            for (const o of bm.markets.h2h ?? []) {
              if (o.name === odds.home) h = o.price;
              else if (o.name === odds.away) a = o.price;
              else if (o.name.toLowerCase().includes("draw")) dr = o.price;
            }
            return { bookmaker: bm.bookmaker, home: h, draw: dr, away: a };
          }).filter((r) => r.home || r.draw || r.away);
        }
      } catch { /* ignore hydration failure — IA receberá o que tiver */ }
    }

    let source: "api" | "manual" = "api";

    // If manual odds were provided, treat them as a "Manual" bookmaker row at the top
    if (data.manual && (data.manual.home || data.manual.draw || data.manual.away)) {
      rows = [
        {
          bookmaker: "Manual (usuário)",
          home: data.manual.home ?? null,
          draw: data.manual.draw ?? null,
          away: data.manual.away ?? null,
        },
        ...rows,
      ];
      source = "manual";
    }

    const bestH = pickBest(rows, "home");
    const bestD = pickBest(rows, "draw");
    const bestA = pickBest(rows, "away");

    const ph = bestH.price > 0 ? 1 / bestH.price : 0;
    const pd = bestD.price > 0 ? 1 / bestD.price : 0;
    const pa = bestA.price > 0 ? 1 / bestA.price : 0;
    const total = ph + pd + pa;
    const nh = total > 0 ? ph / total : 0;
    const nd = total > 0 ? pd / total : 0;
    const na = total > 0 ? pa / total : 0;

    const baseScenarios: RankedScenario[] = [
      {
        rank: 0, outcome: "1", outcomeLabel: `Casa: ${home}`,
        bestOdds: bestH.price, bestBookmaker: bestH.bookmaker,
        prob: nh, edgePct: bestH.price > 0 ? (nh * bestH.price - 1) * 100 : -100,
        reasoning: "",
      },
      {
        rank: 0, outcome: "X", outcomeLabel: "Empate",
        bestOdds: bestD.price, bestBookmaker: bestD.bookmaker,
        prob: nd, edgePct: bestD.price > 0 ? (nd * bestD.price - 1) * 100 : -100,
        reasoning: "",
      },
      {
        rank: 0, outcome: "2", outcomeLabel: `Fora: ${away}`,
        bestOdds: bestA.price, bestBookmaker: bestA.bookmaker,
        prob: na, edgePct: bestA.price > 0 ? (na * bestA.price - 1) * 100 : -100,
        reasoning: "",
      },
    ];

    // Rank by probability (descending = most likely first)
    baseScenarios.sort((a, b) => b.prob - a.prob);
    baseScenarios.forEach((s, i) => { s.rank = i + 1; });

    // ---------- AI reasoning (optional) ----------
    const orKey = process.env.OPENROUTER_API_KEY;
    let aiSummary = "";

    const commenceFmt = fmtCommence(commence_time);

    if (orKey) {
      // DOSSIÊ COMPLETO — IA recebe TODOS os dados do jogo
      const dossier = `### DOSSIÊ DO JOGO

- Mandante (Casa / 1): ${home || "—"}
- Visitante (Fora / 2): ${away || "—"}
- Liga / Competição: ${league || "—"}
- Data e horário: ${commenceFmt}
- ID interno: ${data.matchId}
- Fonte de odds: ${source === "manual" ? "Manual + APIs" : "APIs"}

### ODDS POR CASA DE APOSTA (${rows.length} fontes)
${rows.length === 0 ? "(nenhuma odd disponível)" : rows.map((r) => `- ${r.bookmaker}: 1=${r.home ?? "—"} | X=${r.draw ?? "—"} | 2=${r.away ?? "—"}`).join("\n")}

### MELHORES ODDS (consolidado)
- 1 (${home}): ${bestH.price > 0 ? bestH.price.toFixed(2) : "—"} via ${bestH.bookmaker} → prob ${(nh * 100).toFixed(1)}%
- X (Empate): ${bestD.price > 0 ? bestD.price.toFixed(2) : "—"} via ${bestD.bookmaker} → prob ${(nd * 100).toFixed(1)}%
- 2 (${away}): ${bestA.price > 0 ? bestA.price.toFixed(2) : "—"} via ${bestA.bookmaker} → prob ${(na * 100).toFixed(1)}%

### CENÁRIOS RANQUEADOS POR PROB IMPLÍCITA (1=mais provável)
${baseScenarios.map((s) => `${s.rank}º ${s.outcome} (${s.outcomeLabel}) — odd ${s.bestOdds.toFixed(2)} — prob ${(s.prob * 100).toFixed(1)}%`).join("\n")}`;

      const sys = `Você é um analista quantitativo de apostas esportivas.
Considere o jogo descrito (mandante, visitante, liga, data/horário) e as odds.
Para cada cenário 1/X/2, escreva UMA frase curta (≤ 22 palavras) justificando o rank citando time, probabilidade implícita e contexto da liga quando relevante.
Responda em JSON puro (sem markdown, sem texto extra):
{"reasoning":{"1":"...","X":"...","2":"..."},"summary":"leitura geral do confronto em ≤ 35 palavras citando os times"}`;

      try {
        const raw = await callOpenRouter("openai/gpt-4o-mini", sys, dossier, orKey);
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleaned) as { reasoning: Record<string, string>; summary: string };
        for (const s of baseScenarios) {
          s.reasoning = parsed.reasoning?.[s.outcome] ?? `${s.outcome}: prob ${(s.prob * 100).toFixed(1)}%`;
        }
        aiSummary = parsed.summary ?? "";
      } catch (e) {
        for (const s of baseScenarios) {
          s.reasoning = `Prob implícita ${(s.prob * 100).toFixed(1)}%, edge ${s.edgePct >= 0 ? "+" : ""}${s.edgePct.toFixed(2)}%`;
        }
        aiSummary = `IA indisponível (${(e as Error).message.slice(0, 80)}). Ranking baseado em probabilidade implícita.`;
      }
    } else {
      for (const s of baseScenarios) {
        s.reasoning = `Prob implícita ${(s.prob * 100).toFixed(1)}%, edge ${s.edgePct >= 0 ? "+" : ""}${s.edgePct.toFixed(2)}%`;
      }
      aiSummary = `IA não configurada. ${home} vs ${away} (${league || "—"}) em ${commenceFmt} — ranking pela probabilidade implícita.`;
    }

    return {
      matchId: data.matchId,
      home,
      away,
      league,
      rows,
      scenarios: baseScenarios,
      aiSummary,
      source,
    };
  });

