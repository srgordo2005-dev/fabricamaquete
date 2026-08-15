import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import {
  getMatchContext,
  getMatchOdds,
  type MatchContext,
} from "./odds.functions";

// ============================================================
// CERCAMENTO — multi-match 1/X/2 combinations (Dutching cercado)
// 2 jogos = 9 combinações | 3 jogos = 27 | 4 jogos = 81
// IA classifica cada combinação por probabilidade e edge.
// ============================================================

export interface MatchOdds1X2 {
  matchId: string;
  sportKey: string;
  league: string;
  home: string;
  away: string;
  commence_time: string;
  bestHome: { price: number; bookmaker: string } | null;
  bestDraw: { price: number; bookmaker: string } | null;
  bestAway: { price: number; bookmaker: string } | null;
  // Implied probability normalised (0-1)
  probHome: number;
  probDraw: number;
  probAway: number;
}

export interface Combination {
  id: string; // "H-D-A" pattern
  picks: Array<{
    matchId: string;
    matchLabel: string;
    outcome: "1" | "X" | "2";
    outcomeLabel: string;
    odds: number;
    bookmaker: string;
    prob: number;
  }>;
  combinedOdds: number; // product of odds (if all hit)
  combinedProb: number; // product of probs from market odds
  aiProb?: number;      // probabilidade atribuída pela IA (0-1) — preenchida após análise
  rank: number; // 1 = mais provável (após reordenação pela IA quando disponível)
  recommended: boolean; // top X% por IA
  reasoning?: string;   // IA-generated short reason
}

interface TechnicalAudit {
  idx: number;
  match: string;
  formReal: boolean;
  standingsReal: boolean;
  h2hReal: boolean;
  injuriesReal: boolean;
  hasTechnicalBase: boolean;
  source: MatchContext["source"];
  status: MatchContext["status"];
  statusMessage: string | null;
}

function hasEnoughTechnicalBase(ctx: MatchContext | null) {
  if (!ctx) return false;
  // Aceita qualquer base técnica mínima: forma de algum lado, ou tabela, ou H2H.
  // Não exige tudo — a IA usa o que houver e cita o que faltar.
  const hasForm = !!ctx.homeForm || !!ctx.awayForm;
  const hasStandings = Array.isArray(ctx.standings) && ctx.standings.length > 0;
  const hasH2H = Array.isArray(ctx.h2h) && ctx.h2h.length > 0;
  return hasForm || hasStandings || hasH2H;
}

type OutcomePrice = { price: number; bookmaker: string };

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getCachedMatchFallback(matchId: string) {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("matches_cache")
    .select("league, home, away, commence_time, best_home, best_draw, best_away, bet365_home, bet365_draw, bet365_away")
    .eq("id", matchId)
    .maybeSingle();

  if (error || !data) return null;

  const toOutcome = (primary: unknown, secondary: unknown, source: string): OutcomePrice | null => {
    const raw = Number(primary || secondary || 0);
    return Number.isFinite(raw) && raw > 1 ? { price: raw, bookmaker: source } : null;
  };

  return {
    league: String(data.league ?? "—"),
    home: String(data.home ?? "Mandante"),
    away: String(data.away ?? "Visitante"),
    commence_time: String(data.commence_time ?? ""),
    bestHome: toOutcome(data.best_home, data.bet365_home, data.best_home ? "Cache (melhor odd)" : "Cache Bet365"),
    bestDraw: toOutcome(data.best_draw, data.bet365_draw, data.best_draw ? "Cache (melhor odd)" : "Cache Bet365"),
    bestAway: toOutcome(data.best_away, data.bet365_away, data.best_away ? "Cache (melhor odd)" : "Cache Bet365"),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ensureThreeWayMarket(
  home: OutcomePrice | null,
  draw: OutcomePrice | null,
  away: OutcomePrice | null,
): { home: OutcomePrice; draw: OutcomePrice; away: OutcomePrice } {
  const existing = { home, draw, away };
  const defaultWeights = { home: 0.39, draw: 0.25, away: 0.36 };
  const bounds = {
    home: { min: 1.2, max: 12 },
    draw: { min: 2.4, max: 8 },
    away: { min: 1.2, max: 12 },
  };

  const knownSum = (home ? 1 / home.price : 0) + (draw ? 1 / draw.price : 0) + (away ? 1 / away.price : 0);
  const missingKeys = (Object.keys(existing) as Array<keyof typeof existing>).filter((key) => !existing[key]);

  if (missingKeys.length === 0) {
    return { home: home!, draw: draw!, away: away! };
  }

  const targetTotal = Math.max(1.06, knownSum + 0.12);
  const remainingProb = Math.max(0.12, targetTotal - knownSum);
  const weightSum = missingKeys.reduce((sum, key) => sum + defaultWeights[key], 0);

  for (const key of missingKeys) {
    const prob = remainingProb * (defaultWeights[key] / weightSum);
    const price = clamp(1 / Math.max(prob, 0.08), bounds[key].min, bounds[key].max);
    existing[key] = { price, bookmaker: "Estimativa do sistema" };
  }

  return {
    home: existing.home!,
    draw: existing.draw!,
    away: existing.away!,
  };
}

function buildMatchOddsRecord(args: {
  matchId: string;
  sportKey: string;
  league: string;
  home: string;
  away: string;
  commence_time: string;
  bestHome: OutcomePrice | null;
  bestDraw: OutcomePrice | null;
  bestAway: OutcomePrice | null;
}): MatchOdds1X2 {
  const completed = ensureThreeWayMarket(args.bestHome, args.bestDraw, args.bestAway);
  const ph = 1 / completed.home.price;
  const pd = 1 / completed.draw.price;
  const pa = 1 / completed.away.price;
  const total = ph + pd + pa;

  return {
    matchId: args.matchId,
    sportKey: args.sportKey,
    league: args.league,
    home: args.home,
    away: args.away,
    commence_time: args.commence_time,
    bestHome: completed.home,
    bestDraw: completed.draw,
    bestAway: completed.away,
    probHome: ph / total,
    probDraw: pd / total,
    probAway: pa / total,
  };
}

function repairMatchOdds(match: MatchOdds1X2): MatchOdds1X2 {
  return buildMatchOddsRecord({
    matchId: match.matchId,
    sportKey: match.sportKey,
    league: match.league,
    home: match.home,
    away: match.away,
    commence_time: match.commence_time,
    bestHome: match.bestHome,
    bestDraw: match.bestDraw,
    bestAway: match.bestAway,
  });
}

async function fetchMatches1X2Data(data: { matches: Array<{ matchId: string; sportKey: string }> }): Promise<MatchOdds1X2[]> {
  const results = await Promise.all(
    data.matches.map(async (m) => {
        let odds: Awaited<ReturnType<typeof getMatchOdds>> | null = null;
        try {
          odds = await getMatchOdds({ data: m });
        } catch {
          const fallback = await getCachedMatchFallback(m.matchId);
          if (!fallback) throw new Error(`Odds indisponíveis para ${m.matchId}`);
          return buildMatchOddsRecord({
            matchId: m.matchId,
            sportKey: m.sportKey,
            league: fallback.league,
            home: fallback.home,
            away: fallback.away,
            commence_time: fallback.commence_time,
            bestHome: fallback.bestHome,
            bestDraw: fallback.bestDraw,
            bestAway: fallback.bestAway,
          });
        }

        if (!odds || !Array.isArray(odds.bookmakers)) {
          const fallback = await getCachedMatchFallback(m.matchId);
          if (!fallback) throw new Error(`Odds inválidas para ${m.matchId}`);
          return buildMatchOddsRecord({
            matchId: m.matchId,
            sportKey: m.sportKey,
            league: fallback.league,
            home: fallback.home,
            away: fallback.away,
            commence_time: fallback.commence_time,
            bestHome: fallback.bestHome,
            bestDraw: fallback.bestDraw,
            bestAway: fallback.bestAway,
          });
        }

        let bH: OutcomePrice | null = null;
        let bD: OutcomePrice | null = null;
        let bA: OutcomePrice | null = null;
        for (const bm of odds.bookmakers) {
          for (const o of bm.markets.h2h ?? []) {
            const entry = { price: o.price, bookmaker: bm.bookmaker };
            if (o.name === odds.home) { if (!bH || o.price > bH.price) bH = entry; }
            else if (o.name === odds.away) { if (!bA || o.price > bA.price) bA = entry; }
            else if (o.name.toLowerCase().includes("draw")) { if (!bD || o.price > bD.price) bD = entry; }
          }
        }

        const fallback = await getCachedMatchFallback(m.matchId);
        return buildMatchOddsRecord({
          matchId: m.matchId,
          sportKey: m.sportKey,
          league: odds.league || fallback?.league || "—",
          home: odds.home || fallback?.home || "Mandante",
          away: odds.away || fallback?.away || "Visitante",
          commence_time: odds.commence_time || fallback?.commence_time || "",
          bestHome: bH ?? fallback?.bestHome ?? null,
          bestDraw: bD ?? fallback?.bestDraw ?? null,
          bestAway: bA ?? fallback?.bestAway ?? null,
        });
      }),
    );
  return results;
}

export const getMatches1X2 = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    matches: z.array(z.object({ matchId: z.string(), sportKey: z.string() })).min(1).max(4),
  }).parse(d))
  .handler(async ({ data }): Promise<MatchOdds1X2[]> => fetchMatches1X2Data(data));

// ============================================================
// NOVO: lista TODAS as casas de aposta REAIS por jogo (sem estimativa).
// Retorna apenas o que veio das APIs/cache, sem síntese.
// ============================================================
export interface BookmakerQuote {
  bookmaker: string;
  home: number | null;
  draw: number | null;
  away: number | null;
}
export interface MatchBookmakers {
  matchId: string;
  sportKey: string;
  league: string;
  home: string;
  away: string;
  commence_time: string;
  bookmakers: BookmakerQuote[]; // todas as casas com pelo menos uma odd real
}

export const getMatchesBookmakers = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    matches: z.array(z.object({ matchId: z.string(), sportKey: z.string() })).min(1).max(4),
  }).parse(d))
  .handler(async ({ data }): Promise<MatchBookmakers[]> => {
    const out: MatchBookmakers[] = [];
    for (const m of data.matches) {
      let odds: Awaited<ReturnType<typeof getMatchOdds>> | null = null;
      try { odds = await getMatchOdds({ data: m }); } catch { odds = null; }

      const fallback = await getCachedMatchFallback(m.matchId);
      const home = odds?.home || fallback?.home || "Mandante";
      const away = odds?.away || fallback?.away || "Visitante";
      const league = odds?.league || fallback?.league || "—";
      const commence_time = odds?.commence_time || fallback?.commence_time || "";

      const quotesMap = new Map<string, BookmakerQuote>();
      for (const bm of odds?.bookmakers ?? []) {
        const q: BookmakerQuote = { bookmaker: bm.bookmaker, home: null, draw: null, away: null };
        for (const o of bm.markets.h2h ?? []) {
          if (o.name === home) q.home = o.price;
          else if (o.name === away) q.away = o.price;
          else if (o.name.toLowerCase().includes("draw")) q.draw = o.price;
        }
        // só adiciona casas que tem ao menos UMA odd real
        if (q.home || q.draw || q.away) quotesMap.set(bm.bookmaker, q);
      }
      // Adiciona Bet365 do cache se existir e não estiver na lista
      if (fallback && !quotesMap.has("Bet365 (cache)")) {
        const cb: BookmakerQuote = {
          bookmaker: "Bet365 (cache)",
          home: fallback.bestHome?.price ?? null,
          draw: fallback.bestDraw?.price ?? null,
          away: fallback.bestAway?.price ?? null,
        };
        if (cb.home || cb.draw || cb.away) quotesMap.set(cb.bookmaker, cb);
      }

      out.push({
        matchId: m.matchId,
        sportKey: m.sportKey,
        league, home, away, commence_time,
        bookmakers: Array.from(quotesMap.values()),
      });
    }
    return out;
  });


// Generate cartesian product of 1/X/2 across N matches
export function generateCombinations(matches: MatchOdds1X2[]): Combination[] {
  const outcomes: Array<{ key: "1" | "X" | "2"; label: string; getter: (m: MatchOdds1X2) => { price: number; bookmaker: string; prob: number; outcomeLabel: string } | null }> = [
    { key: "1", label: "Casa", getter: (m) => m.bestHome ? { price: m.bestHome.price, bookmaker: m.bestHome.bookmaker, prob: m.probHome, outcomeLabel: m.home } : null },
    { key: "X", label: "Empate", getter: (m) => m.bestDraw ? { price: m.bestDraw.price, bookmaker: m.bestDraw.bookmaker, prob: m.probDraw, outcomeLabel: "Empate" } : null },
    { key: "2", label: "Fora", getter: (m) => m.bestAway ? { price: m.bestAway.price, bookmaker: m.bestAway.bookmaker, prob: m.probAway, outcomeLabel: m.away } : null },
  ];

  const combos: Combination[] = [];
  const recurse = (idx: number, currentPicks: Combination["picks"], pattern: string[]) => {
    if (idx === matches.length) {
      const combinedOdds = currentPicks.reduce((a, p) => a * p.odds, 1);
      const combinedProb = currentPicks.reduce((a, p) => a * p.prob, 1);
      combos.push({
        id: pattern.join("-"),
        picks: currentPicks,
        combinedOdds,
        combinedProb,
        rank: 0,
        recommended: false,
      });
      return;
    }
    const m = matches[idx];
    for (const out of outcomes) {
      const o = out.getter(m);
      if (!o) continue;
      recurse(idx + 1, [...currentPicks, {
        matchId: m.matchId,
        matchLabel: `${m.home} vs ${m.away}`,
        outcome: out.key,
        outcomeLabel: o.outcomeLabel,
        odds: o.price,
        bookmaker: o.bookmaker,
        prob: o.prob,
      }], [...pattern, out.key]);
    }
  };
  recurse(0, [], []);

  // Rank by combined probability (descending)
  combos.sort((a, b) => b.combinedProb - a.combinedProb);
  combos.forEach((c, i) => { c.rank = i + 1; });
  return combos;
}

// ============================================================
// IA via Lovable AI Gateway (chave gerenciada — sem dependência externa)
// Usa tool calling para garantir saída estruturada com probabilidade
// e justificativa POR COMBINAÇÃO. Sem mais "impossível calcular".
// ============================================================

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// PIPELINE DE 3 CAMADAS — cada IA com papel ESPECÍFICO e modelo DISTINTO.
// Camada 1: Minerador (busca web em tempo real via Perplexity)
const MINER_MODEL = { id: "perplexity/sonar", label: "Minerador · Perplexity Sonar" };

// Camada 2: 3 Analistas especialistas — cada um com foco diferente
const ANALYST_MODELS: Array<{ id: string; label: string; role: "matematico" | "tecnico" | "contexto" }> = [
  { id: "openai/gpt-5", label: "Analista 1 · O Matemático (GPT-5)", role: "matematico" },
  { id: "google/gemini-2.5-pro", label: "Analista 2 · O Técnico (Gemini 2.5 Pro)", role: "tecnico" },
  { id: "anthropic/claude-sonnet-4.5", label: "Analista 3 · O Contexto (Claude Sonnet 4.5)", role: "contexto" },
];

// Camada 3: Juiz Supremo
const JUDGE_MODEL = { id: "google/gemini-3.1-pro-preview", label: "Juiz Supremo · Gemini 3.1 Pro" };

// Timeout individual por chamada
const PER_CALL_TIMEOUT_MS = 25_000;
const MINER_TIMEOUT_MS = 30_000;

async function callAITool(
  model: string,
  system: string,
  user: string,
  toolName: string,
  parameters: Record<string, unknown>,
  key: string,
  timeoutMs = PER_CALL_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [{
          type: "function",
          function: {
            name: toolName,
            description: "Retorna análise estruturada de cercamento.",
            parameters,
          },
        }],
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === "AbortError") throw new Error(`Timeout ${timeoutMs / 1000}s no modelo ${model}`);
    throw e;
  }
  clearTimeout(timer);
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Rate limit da IA. Tente em 1 minuto.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione fundos em Settings → Workspace → Usage.");
    throw new Error(`AI ${res.status}: ${t.slice(0, 160)}`);
  }
  const j = await res.json();
  const call = j.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("IA não retornou tool call.");
  try { return JSON.parse(call.function.arguments); }
  catch { throw new Error("Falha ao parsear JSON da IA."); }
}

// ============================================================
// MINERADOR — busca web em tempo real via OpenRouter (Perplexity Sonar)
// Retorna texto técnico tabular bruto. Sem JSON estruturado — é matéria-prima.
// ============================================================
async function callMinerOpenRouter(system: string, user: string, key: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MINER_TIMEOUT_MS);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://madureirabet.lovable.app",
        "X-Title": "MadureiraBet Cercamento Miner",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MINER_MODEL.id,
        temperature: 0.1,
        max_tokens: 2500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Minerador ${res.status}: ${t.slice(0, 160)}`);
    }
    const j = await res.json();
    return String(j.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(timer);
  }
}

export interface AnalystOpinion { model: string; ok: boolean; content: string }

export const analyzeCombinations = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    matches: z.array(z.object({ matchId: z.string(), sportKey: z.string() })).min(2).max(4),
    // Odds CONCRETAS escolhidas pelo usuário (casa específica ou manual).
    // Quando presentes, substituem TUDO — sem estimativa do sistema.
    userOdds: z.array(z.object({
      matchId: z.string(),
      home: z.number().min(1.01).max(1000),
      draw: z.number().min(1.01).max(1000),
      away: z.number().min(1.01).max(1000),
      source: z.string().min(1).max(80), // "Bet365" / "Manual" / etc
    })).optional(),
  }).parse(d))
  .handler(async ({ data }): Promise<{
    matches: MatchOdds1X2[];
    combinations: Combination[];
    aiSummary: string;
    opinions: AnalystOpinion[];
  }> => {
    const rawMatches = await fetchMatches1X2Data(data);

    // Se o usuário forneceu odds concretas, sobrescreve TUDO (sem estimativa)
    const userOddsMap = new Map(
      (data.userOdds ?? []).map((u) => [u.matchId, u]),
    );
    const matches = rawMatches.map((m) => {
      const u = userOddsMap.get(m.matchId);
      if (u) {
        return buildMatchOddsRecord({
          matchId: m.matchId,
          sportKey: m.sportKey,
          league: m.league,
          home: m.home,
          away: m.away,
          commence_time: m.commence_time,
          bestHome: { price: u.home, bookmaker: u.source },
          bestDraw: { price: u.draw, bookmaker: u.source },
          bestAway: { price: u.away, bookmaker: u.source },
        });
      }
      return repairMatchOdds(m);
    });
    const combinations = generateCombinations(matches);


    const aiKey = process.env.LOVABLE_API_KEY;
    if (!aiKey) {
      const topCount = Math.max(1, Math.ceil(combinations.length * 0.5));
      combinations.slice(0, topCount).forEach((c) => { c.recommended = true; });
      return {
        matches, combinations,
        aiSummary: "IA não configurada (LOVABLE_API_KEY ausente). Ranking pelas odds das casas.",
        opinions: [],
      };
    }

    // ============================================================
    // DOSSIÊ TÉCNICO — contexto completo de cada jogo, sem odds no raciocínio
    // ============================================================
    const contextResults = await Promise.allSettled(
      matches.map((m) => getMatchContext({ data: { home: m.home, away: m.away } })),
    );
    const contextMap = new Map<string, MatchContext | null>();
    matches.forEach((m, i) => {
      const res = contextResults[i];
      contextMap.set(m.matchId, res.status === "fulfilled" ? res.value : null);
    });

    const formText = (ctx: MatchContext | null, side: "home" | "away") => {
      const form = side === "home" ? ctx?.homeForm : ctx?.awayForm;
      const team = side === "home" ? matches.find((m) => contextMap.get(m.matchId) === ctx)?.home : matches.find((m) => contextMap.get(m.matchId) === ctx)?.away;
      if (!form) return `${team ?? "time"}: forma recente indisponível`;
      const last5 = form.last5.map((g) => `${g.result}${g.gf}-${g.ga} vs ${g.opponent} (${g.venue === "H" ? "casa" : "fora"})`).join(" | ");
      return `${form.wins}V/${form.draws}E/${form.losses}D nos últimos 5 · gols ${form.gfTotal}-${form.gaTotal} · sequência ${form.streak} · ${last5}`;
    };

    const dataAudit: TechnicalAudit[] = matches.map((m, i) => {
      const ctx = contextMap.get(m.matchId);
      return {
        idx: i + 1,
        match: `${m.home} vs ${m.away}`,
        formReal: !!(ctx?.homeForm && ctx?.awayForm),
        standingsReal: !!(ctx?.standings && ctx.standings.length > 0),
        h2hReal: !!(ctx?.h2h && ctx.h2h.length > 0),
        injuriesReal: !!(ctx && (ctx.homeInj.length > 0 || ctx.awayInj.length > 0 || ctx.status !== "unavailable")),
        hasTechnicalBase: hasEnoughTechnicalBase(ctx ?? null),
        source: ctx?.source ?? "unavailable",
        status: ctx?.status ?? "unavailable",
        statusMessage: ctx?.statusMessage ?? null,
      };
    });
    const auditBlock = dataAudit.map((a) =>
      `Jogo ${a.idx} (${a.match}): forma=${a.formReal ? "REAL" : "AUSENTE"} · tabela=${a.standingsReal ? "REAL" : "AUSENTE"} · H2H=${a.h2hReal ? "REAL" : "AUSENTE"} · desfalques=${a.injuriesReal ? "CONSULTADOS" : "AUSENTES"} · base=${a.hasTechnicalBase ? "TÉCNICA OK" : "INSUFICIENTE"} · origem=${a.source}`,
    ).join("\n");

    const missingBase = dataAudit.filter((a) => !a.hasTechnicalBase);
    if (missingBase.length > 0) {
      console.warn(`[cercamento] Base interna fraca para: ${missingBase.map((a) => a.match).join(", ")} — Minerador (Perplexity) preencherá a lacuna.`);
    }

    const matchSummary = matches.map((m, i) => {
      const dt = m.commence_time ? new Date(m.commence_time).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      }) + " (Brasília)" : "—";
      const ctx = contextMap.get(m.matchId);
      const standings = ctx?.standings ?? [];
      const homeRow = standings.find((s) => s.team.toLowerCase().includes(m.home.toLowerCase().split(" ")[0]));
      const awayRow = standings.find((s) => s.team.toLowerCase().includes(m.away.toLowerCase().split(" ")[0]));
      const h2hLine = ctx?.h2h?.length
        ? ctx.h2h.slice(0, 5).map((g) => `${new Date(g.date).toLocaleDateString("pt-BR")}: ${g.home} ${g.score} ${g.away}`).join(" | ")
        : "sem H2H recente";
      return `━━━ JOGO ${i + 1} ━━━
  Confronto: ${m.home} vs ${m.away}
  Liga / Campeonato: ${m.league}
  Data e horário: ${dt}
  Identificador interno do jogo: ${m.matchId}
  Tabela ${m.home}: ${homeRow ? `${homeRow.rank}º, ${homeRow.points} pts, SG ${homeRow.gd >= 0 ? "+" : ""}${homeRow.gd}, forma ${homeRow.form}` : "indisponível"}
  Tabela ${m.away}: ${awayRow ? `${awayRow.rank}º, ${awayRow.points} pts, SG ${awayRow.gd >= 0 ? "+" : ""}${awayRow.gd}, forma ${awayRow.form}` : "indisponível"}
  Forma recente do ${m.home}: ${formText(ctx ?? null, "home")}
  Forma recente do ${m.away}: ${formText(ctx ?? null, "away")}
  Desfalques ${m.home}: ${ctx?.homeInj.length ? ctx.homeInj.join(", ") : "nenhum reportado"}
  Desfalques ${m.away}: ${ctx?.awayInj.length ? ctx.awayInj.join(", ") : "nenhum reportado"}
  H2H recente: ${h2hLine}`;
    }).join("\n\n");

    // Lista NUMERADA de TODAS as combinações com nomes reais dos times
    const comboList = combinations.map((c, idx) => {
      const desc = c.picks.map((p) => {
        if (p.outcome === "1") return `${p.outcomeLabel} vence (mandante)`;
        if (p.outcome === "2") return `${p.outcomeLabel} vence (visitante)`;
        return `Empate em ${p.matchLabel}`;
      }).join("  +  ");
      return `${idx + 1}) id=${c.id} → ${desc}`;
    }).join("\n");

    const dossier = `### CERCAMENTO MULTI-JOGO — ${matches.length} jogo(s), ${combinations.length} combinação(ões) totais

═══════════════════════════════════════════
AUDITORIA DAS FONTES (use APENAS isto — não invente):
═══════════════════════════════════════════
${auditBlock}

═══════════════════════════════════════════
DADOS COMPLETOS DOS JOGOS:
═══════════════════════════════════════════
${matchSummary}

═══════════════════════════════════════════
TODAS AS ${combinations.length} COMBINAÇÕES POSSÍVEIS
(1=mandante vence, X=empate, 2=visitante vence):
═══════════════════════════════════════════
${comboList}

REGRA OBRIGATÓRIA: você DEVE retornar uma entrada para CADA UMA das ${combinations.length} combinações acima, usando exatamente o "id" listado.
REGRA DE HONESTIDADE: cada probability_pct DEVE ser justificada citando fonte técnica concreta acima (forma, tabela, desfalques, H2H, padrão defensivo/ofensivo). PROIBIDO usar odds como justificativa.`;

    // Log do dossiê pra confirmar que a IA recebeu tudo
    console.log(`[cercamento] dossiê montado: ${dossier.length} chars, ${matches.length} jogos, ${combinations.length} combos, forma real: ${dataAudit.filter((a) => a.formReal).length}/${dataAudit.length}, tabela real: ${dataAudit.filter((a) => a.standingsReal).length}/${dataAudit.length}`);


    // ============================================================
    // ETAPA 1 — MINERADOR (Perplexity Sonar via OpenRouter)
    // Busca dados brutos de mercado, xG, desfalques, clima, logística.
    // ============================================================
    const orKey = process.env.OPENROUTER_API_KEY;
    let minerOutput = "";
    let minerOk = false;
    let minerError = "";

    if (orKey) {
      const minerSys = `# ROLE: LEAD DATA SCIENTIST & DEEP MINING EXPERT
Você é um cientista de dados de elite. Sua tarefa é minerar dados REAIS via busca web em tempo real.
PROIBIDO inventar números. Se algum dado não for encontrado, escreva exatamente "DADOS INSUFICIENTES" para aquele campo.
Saída SEMPRE técnica e tabular.`;

      const matchesText = matches.map((m, i) => {
        const dt = m.commence_time ? new Date(m.commence_time).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        }) + " (Brasília)" : "data desconhecida";
        return `JOGO ${i + 1}: ${m.home} x ${m.away} | Liga: ${m.league} | Data/Horário: ${dt}`;
      }).join("\n");

      const minerUser = `Investigue os confrontos:
${matchesText}

PROTOCOLO OBRIGATÓRIO (responda cada item para CADA jogo):
1. Odds 1X2 atuais na Bet365 e tendência de movimentação (subindo/caindo) nas últimas 24h.
2. Médias de gols (GF/GS) e xG dos últimos 5 jogos de cada time.
3. Desfalques confirmados, suspensos, retornos e jogadores em dúvida.
4. Clima previsto no estádio (temperatura, chuva, vento) na hora do jogo.
5. Logística: distância de viagem do visitante e dias de descanso de cada equipe.
6. Posição na tabela, motivação (briga por título/Libertadores/rebaixamento) e últimos 5 resultados.
7. H2H direto: últimos 5 confrontos.

OUTPUT: Apresente os dados em formato técnico e tabular, separado por jogo. Se faltarem dados cruciais para algum item, escreva "DADOS INSUFICIENTES" naquele item específico.`;

      try {
        minerOutput = await callMinerOpenRouter(minerSys, minerUser, orKey);
        minerOk = minerOutput.length > 100;
        if (!minerOk) minerError = "Minerador retornou conteúdo vazio.";
      } catch (e) {
        minerError = (e as Error).message;
        minerOk = false;
      }
    } else {
      minerError = "OPENROUTER_API_KEY ausente — Minerador (Perplexity) não configurado.";
    }

    console.log(`[cercamento] Minerador: ${minerOk ? "OK " + minerOutput.length + " chars" : "FALHOU - " + minerError}`);

    // Bloco de dados brutos do Minerador (será injetado nos prompts dos analistas)
    const minerBlock = minerOk
      ? `═══════════════════════════════════════════
📡 DADOS DO MINERADOR (Perplexity Sonar — busca web em tempo real):
═══════════════════════════════════════════
${minerOutput}

═══════════════════════════════════════════`
      : `⚠ MINERADOR FALHOU (${minerError}). Use APENAS o dossiê interno abaixo (forma, tabela, H2H, desfalques das APIs oficiais).`;

    // ============================================================
    // ETAPA 2 — 3 ANALISTAS ESPECIALISTAS EM PARALELO
    // Cada um com PAPEL DIFERENTE e FILTRO "BURACO NEGRO".
    // ============================================================

    const analystParams = {
      type: "object",
      properties: {
        black_hole: {
          type: "boolean",
          description: "true se os dados são insuficientes/inconsistentes para análise séria (BURACO NEGRO DETECTADO).",
        },
        match_summaries: {
          type: "array",
          description: `${matches.length} resumos, um por jogo, citando nomes corretos, liga, data/horário e análise específica do seu papel (60-100 palavras cada).`,
          items: {
            type: "object",
            properties: {
              match_index: { type: "number" },
              home: { type: "string" },
              away: { type: "string" },
              league: { type: "string" },
              datetime: { type: "string" },
              summary: { type: "string" },
            },
            required: ["match_index", "home", "away", "league", "datetime", "summary"],
            additionalProperties: false,
          },
        },
        match_probabilities: {
          type: "array",
          description: `${matches.length} entradas: probabilidade % de 1, X e 2 para cada jogo (devem somar ~100% por jogo).`,
          items: {
            type: "object",
            properties: {
              match_index: { type: "number" },
              prob_home_pct: { type: "number" },
              prob_draw_pct: { type: "number" },
              prob_away_pct: { type: "number" },
            },
            required: ["match_index", "prob_home_pct", "prob_draw_pct", "prob_away_pct"],
            additionalProperties: false,
          },
        },
        combinations: {
          type: "array",
          description: `EXATAMENTE ${combinations.length} entradas, uma para cada id listado.`,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              probability_pct: { type: "number" },
              reason: { type: "string", description: "motivo curto citando evidência concreta do seu papel" },
            },
            required: ["id", "probability_pct", "reason"],
            additionalProperties: false,
          },
        },
        opinion: { type: "string", description: "Parecer técnico em até 80 palavras sob o ângulo do seu papel." },
      },
      required: ["black_hole", "match_summaries", "match_probabilities", "combinations", "opinion"],
      additionalProperties: false,
    };

    const rolePrompts: Record<"matematico" | "tecnico" | "contexto", { sys: string; task: string }> = {
      matematico: {
        sys: `# ROLE: O MATEMÁTICO (foco: estatística pura)
Você é um matemático especialista em apostas. Calcule a Probabilidade 1X2 usando Distribuição de Poisson aplicada às médias de gols (GF/GS), xG e médias móveis dos últimos 5 jogos. Forneça as % EXATAS para 1, X e 2 de cada jogo.
FILTRO BURACO NEGRO: se os números do Minerador forem inconsistentes, contraditórios ou ausentes, responda black_hole=true e justifique.
PROIBIDO chutar. PROIBIDO usar feeling. SOMENTE matemática aplicada.`,
        task: `Calcule via Poisson + médias móveis as % de 1, X e 2 de cada jogo. Depois preencha as ${combinations.length} combinações multiplicando as probabilidades dos jogos.`,
      },
      tecnico: {
        sys: `# ROLE: O TÉCNICO (foco: desempenho tático e xG)
Você é um analista tático. Analise o ENCAIXE TÁTICO de cada confronto e as métricas de xG (Gols Esperados). O favoritismo do mercado se justifica pelo volume de jogo recente? Há mismatch tático? Quem tem mais finalizações de qualidade?
FILTRO BURACO NEGRO: se não houver métricas de performance sólidas (xG, finalizações, posse), responda black_hole=true.
PROIBIDO chutar. SOMENTE leitura tática baseada em números reais.`,
        task: `Avalie o encaixe tático e xG de cada jogo. Atribua % de 1, X e 2 baseado em volume de jogo e xG. Depois ranqueie as ${combinations.length} combinações.`,
      },
      contexto: {
        sys: `# ROLE: O CONTEXTO (foco: fator humano)
Você é um analista de contexto. Analise MOTIVAÇÃO (posição na tabela, briga por título/rebaixamento), IMPACTO DE DESFALQUES (peso real dos ausentes), DESGASTE FÍSICO (jogos seguidos, viagens) e CLIMA (chuva, calor extremo).
Aplique PESOS de força emocional e física para ajustar quem chega em melhores condições.
FILTRO BURACO NEGRO: se o cenário for imprevisível (sem notícias, sem clima, sem informação de desfalques), responda black_hole=true.
PROIBIDO chutar. SOMENTE leitura humana baseada em fatos reportados.`,
        task: `Aplique pesos de motivação, desfalques, desgaste e clima. Atribua % de 1, X e 2 baseado nesses fatores humanos. Depois ranqueie as ${combinations.length} combinações.`,
      },
    };

    const buildAnalystUser = (role: "matematico" | "tecnico" | "contexto") => `${minerBlock}

═══════════════════════════════════════════
📊 DOSSIÊ INTERNO (APIs oficiais — forma, tabela, H2H, desfalques):
═══════════════════════════════════════════
${dossier}

═══════════════════════════════════════════
🎯 SUA TAREFA (papel: ${role.toUpperCase()})
═══════════════════════════════════════════
${rolePrompts[role].task}

OBRIGAÇÕES:
1. "black_hole": true SE os dados forem insuficientes/inconsistentes para o seu ângulo de análise.
2. "match_summaries": ${matches.length} resumo(s) sob o seu ângulo (60-100 palavras cada).
3. "match_probabilities": % de 1, X, 2 para CADA jogo (somando ~100% por jogo).
4. "combinations": ${combinations.length} entradas, uma por id, com probability_pct e reason curta citando evidência do SEU PAPEL.
5. "opinion": parecer em até 80 palavras sob o seu ângulo.`;

    // 3 analistas em paralelo
    const analystResults = await Promise.allSettled(
      ANALYST_MODELS.map((m) => callAITool(
        m.id,
        rolePrompts[m.role].sys,
        buildAnalystUser(m.role),
        "analyze_role",
        analystParams,
        aiKey,
      )),
    );

    const opinions: AnalystOpinion[] = [];
    const probsById = new Map<string, number[]>();
    const reasonsById = new Map<string, string[]>();
    combinations.forEach((c) => { probsById.set(c.id, []); reasonsById.set(c.id, []); });

    const analystFindings: string[] = [];
    let blackHoleCount = 0;

    analystResults.forEach((r, idx) => {
      const meta = ANALYST_MODELS[idx];
      if (r.status !== "fulfilled") {
        opinions.push({ model: meta.label, ok: false, content: (r.reason as Error)?.message ?? "falhou" });
        return;
      }
      const blackHole = Boolean(r.value.black_hole);
      if (blackHole) blackHoleCount++;
      const aiCombos = (r.value.combinations as Array<{ id: string; probability_pct: number; reason: string }>) ?? [];
      const matchSummariesAI = (r.value.match_summaries as Array<{ match_index: number; home: string; away: string; league: string; datetime: string; summary: string }>) ?? [];
      const matchProbs = (r.value.match_probabilities as Array<{ match_index: number; prob_home_pct: number; prob_draw_pct: number; prob_away_pct: number }>) ?? [];
      const opinion = String(r.value.opinion ?? "");

      // Só agrega probs se NÃO declarou buraco negro
      if (!blackHole) {
        for (const a of aiCombos) {
          const arr = probsById.get(a.id);
          if (arr) arr.push(Number(a.probability_pct) || 0);
          const ra = reasonsById.get(a.id);
          if (ra && a.reason) ra.push(a.reason);
        }
      }

      const summariesBlock = matchSummariesAI.length > 0
        ? `**📋 Resumo dos jogos:**\n${matchSummariesAI.map((s) => `\n**Jogo ${s.match_index} — ${s.home} vs ${s.away}** (${s.league} · ${s.datetime})\n${s.summary}`).join("\n")}\n\n`
        : "";
      const probsBlock = matchProbs.length > 0
        ? `**📊 Probabilidades por jogo:**\n${matchProbs.map((p) => `Jogo ${p.match_index}: 1=${p.prob_home_pct.toFixed(1)}% · X=${p.prob_draw_pct.toFixed(1)}% · 2=${p.prob_away_pct.toFixed(1)}%`).join("\n")}\n\n`
        : "";

      opinions.push({
        model: meta.label,
        ok: true,
        content: `${blackHole ? "⚫ **BURACO NEGRO DETECTADO** por este analista — dados insuficientes/inconsistentes para o ângulo dele.\n\n" : ""}${summariesBlock}${probsBlock}**🎯 Parecer:** ${opinion}\n\n**Top 3 desse analista:**\n${
          aiCombos.slice().sort((a, b) => b.probability_pct - a.probability_pct).slice(0, 3)
            .map((c, i) => `${i + 1}. \`${c.id}\` → ${c.probability_pct.toFixed(1)}% — ${c.reason}`).join("\n")
        }`,
      });
      analystFindings.push(`### ${meta.label}${blackHole ? " [BURACO NEGRO]" : ""}\nResumos: ${matchSummariesAI.map((s) => `J${s.match_index}=${s.summary.slice(0, 80)}`).join(" || ")}\nProbs por jogo: ${matchProbs.map((p) => `J${p.match_index} 1=${p.prob_home_pct.toFixed(1)} X=${p.prob_draw_pct.toFixed(1)} 2=${p.prob_away_pct.toFixed(1)}`).join(" | ")}\nParecer: ${opinion}\nProbs combinações: ${aiCombos.map((c) => `${c.id}=${c.probability_pct.toFixed(1)}%`).join(", ")}`);
    });

    const okAnalysts = opinions.filter((o) => o.ok && !o.content.startsWith("⚫")).length;

    // Probabilidade média apenas dos analistas válidos (sem buraco negro)
    const avgProbById = new Map<string, number>();
    for (const c of combinations) {
      const arr = probsById.get(c.id) ?? [];
      if (arr.length > 0) avgProbById.set(c.id, arr.reduce((a, b) => a + b, 0) / arr.length);
    }

    // ============================================================
    // ETAPA 3 — JUIZ SUPREMO & RISK AUDITOR
    // Calcula matriz, odd justa, EV+ e veredito final.
    // ============================================================
    let aiSummary = "";
    let recommendedIds: string[] = [];

    // Tabela de odds reais (do mercado/best) para o juiz comparar contra a odd justa
    const marketOddsTable = matches.map((m, i) =>
      `Jogo ${i + 1} (${m.home} vs ${m.away}): 1=${m.bestHome?.price.toFixed(2)} (${m.bestHome?.bookmaker}) · X=${m.bestDraw?.price.toFixed(2)} (${m.bestDraw?.bookmaker}) · 2=${m.bestAway?.price.toFixed(2)} (${m.bestAway?.bookmaker})`,
    ).join("\n");

    const judgeParams = {
      type: "object",
      properties: {
        black_hole_final: {
          type: "boolean",
          description: "true se TODOS ou MAIORIA dos analistas declararam buraco negro — operação anulada.",
        },
        combinations: {
          type: "array",
          description: `EXATAMENTE ${combinations.length} entradas, uma por id, com média ponderada de probability_pct, fair_odds (1/prob), market_odds (produto das odds das casas), edge_pct ((prob*market_odds)-1)*100 e value_found (true se market_odds > fair_odds).`,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              probability_pct: { type: "number", description: "média ponderada das 3 análises, 0-100" },
              fair_odds: { type: "number", description: "odd justa = 1 / (probability_pct/100)" },
              market_odds: { type: "number", description: "produto das odds reais do mercado" },
              edge_pct: { type: "number", description: "((probability/100) * market_odds - 1) * 100" },
              value_found: { type: "boolean", description: "true se market_odds > fair_odds (EV+)" },
              reason: { type: "string", description: "motivo curto citando consenso dos 3 analistas" },
            },
            required: ["id", "probability_pct", "fair_odds", "market_odds", "edge_pct", "value_found", "reason"],
            additionalProperties: false,
          },
        },
        recommended_ids: {
          type: "array",
          description: "ids com VALOR ENCONTRADO (market_odds > fair_odds) E entre os top 50% mais prováveis.",
          items: { type: "string" },
        },
        verdict: { type: "string", description: "Veredito da Entrada Mais Segura em até 120 palavras citando times, % final, odd justa vs odd da casa e se há valor." },
      },
      required: ["black_hole_final", "combinations", "recommended_ids", "verdict"],
      additionalProperties: false,
    };

    const judgeSys = `# ROLE: JUIZ SUPREMO & RISK AUDITOR
Você audita as 3 análises (Matemático, Técnico, Contexto) e emite o veredito final.

PROTOCOLO OBRIGATÓRIO:
1. SE houver "BURACO NEGRO" declarado pela MAIORIA (≥2 de 3) dos analistas, marque black_hole_final=true e anule a operação no veredito.
2. Calcule a MÉDIA PONDERADA das probabilidades de cada combinação (peso igual entre os analistas válidos).
3. Para cada uma das ${combinations.length} combinações:
   - probability_pct = média ponderada (0-100)
   - fair_odds = 1 / (probability_pct/100)
   - market_odds = produto das odds reais das casas (já calculado)
   - edge_pct = ((probability_pct/100) * market_odds - 1) * 100
   - value_found = true SE market_odds > fair_odds (EV+ confirmado)
4. Em recommended_ids: liste APENAS ids com value_found=true E entre os top 50% mais prováveis.
5. Em verdict: declare a "Entrada Mais Segura" (id com maior probabilidade E value_found=true). Se nenhuma tem valor, declare "RISCO: SEM VALOR ENCONTRADO".
A SOMA dos probability_pct DEVE ficar entre 95 e 105.`;

    const judgeUser = `${minerBlock}

═══════════════════════════════════════════
📊 DOSSIÊ INTERNO (APIs oficiais):
═══════════════════════════════════════════
${dossier}

═══════════════════════════════════════════
🧮 ODDS REAIS DO MERCADO (use para market_odds e EV+):
═══════════════════════════════════════════
${marketOddsTable}

Produto das odds (market_odds) por combinação:
${combinations.map((c) => `${c.id}: ${c.combinedOdds.toFixed(3)}`).join("\n")}

═══════════════════════════════════════════
👥 PARECERES DOS 3 ANALISTAS:
═══════════════════════════════════════════
${analystFindings.join("\n\n")}

Buracos negros declarados: ${blackHoleCount}/3
Analistas válidos: ${okAnalysts}/3
Média consolidada por combinação:
${combinations.map((c) => `${c.id}: ${(avgProbById.get(c.id) ?? 0).toFixed(1)}%`).join("\n")}

═══════════════════════════════════════════
🎯 EXECUTE O PROTOCOLO E RETORNE A MATRIZ DE ${combinations.length} COMBINAÇÕES.
═══════════════════════════════════════════`;

    try {
      if (okAnalysts === 0 && blackHoleCount === 0) {
        throw new Error("Nenhum analista respondeu — pipeline interrompido.");
      }

      const judged = await callAITool(JUDGE_MODEL.id, judgeSys, judgeUser, "judge_supreme", judgeParams, aiKey);
      const judgeCombos = (judged.combinations as Array<{ id: string; probability_pct: number; fair_odds: number; market_odds: number; edge_pct: number; value_found: boolean; reason: string }>) ?? [];
      const blackHoleFinal = Boolean(judged.black_hole_final);
      recommendedIds = (judged.recommended_ids as string[]) ?? [];
      aiSummary = String(judged.verdict ?? "");

      const judgeProb = new Map<string, number>();
      const judgeReason = new Map<string, string>();
      const judgeValue = new Map<string, boolean>();
      const judgeFair = new Map<string, number>();
      const judgeEdge = new Map<string, number>();
      for (const j of judgeCombos) {
        judgeProb.set(j.id, Number(j.probability_pct) || 0);
        if (j.reason) judgeReason.set(j.id, j.reason);
        judgeValue.set(j.id, Boolean(j.value_found));
        judgeFair.set(j.id, Number(j.fair_odds) || 0);
        judgeEdge.set(j.id, Number(j.edge_pct) || 0);
      }

      for (const c of combinations) {
        const fromJudge = judgeProb.get(c.id);
        if (typeof fromJudge === "number") {
          c.aiProb = fromJudge / 100;
        } else {
          const avg = avgProbById.get(c.id);
          c.aiProb = typeof avg === "number" ? avg / 100 : c.combinedProb;
        }
        const fair = judgeFair.get(c.id) ?? (c.aiProb && c.aiProb > 0 ? 1 / c.aiProb : 0);
        const edge = judgeEdge.get(c.id) ?? 0;
        const value = judgeValue.get(c.id) ?? false;
        const baseReason = judgeReason.get(c.id) ?? (reasonsById.get(c.id)?.[0]) ?? "";
        c.reasoning = `${baseReason}${baseReason ? " · " : ""}Odd justa ${fair.toFixed(2)} vs mercado ${c.combinedOdds.toFixed(2)} · edge ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%${value ? " · VALOR ✅" : ""}`;
      }

      // Ordena por probabilidade do juiz, decrescente
      combinations.sort((a, b) => (b.aiProb ?? 0) - (a.aiProb ?? 0));
      const recSet = new Set(recommendedIds);
      combinations.forEach((c, i) => {
        c.rank = i + 1;
        c.recommended = recSet.size > 0 ? recSet.has(c.id) : false;
      });

      const verdictHeader = blackHoleFinal
        ? `🚨 **OPERAÇÃO ANULADA — BURACO NEGRO FINAL** (${blackHoleCount}/3 analistas declararam dados insuficientes).\n\n`
        : "";

      opinions.push({
        model: JUDGE_MODEL.label,
        ok: true,
        content: `🧑‍⚖️ **Veredito do Juiz Supremo:**\n\n${verdictHeader}${aiSummary}\n\n**Matriz completa de ${combinations.length} combinações:**\n${combinations.map((c) => {
          const prob = ((c.aiProb ?? 0) * 100).toFixed(1);
          const fair = judgeFair.get(c.id) ?? 0;
          const edge = judgeEdge.get(c.id) ?? 0;
          const value = judgeValue.get(c.id) ?? false;
          return `${c.rank}. \`${c.id}\` → ${prob}% · justa ${fair.toFixed(2)} · mercado ${c.combinedOdds.toFixed(2)} · edge ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%${value ? " ✅ VALOR" : ""}${c.recommended ? " 🎯 RECOMENDADA" : ""}`;
        }).join("\n")}`,
      });

      aiSummary = `${verdictHeader}${aiSummary}`;
    } catch (e) {
      const err = (e as Error).message;
      if (okAnalysts === 0) {
        throw new Error(`Pipeline falhou: ${err}. Sem consenso técnico, nenhuma porcentagem foi exibida para evitar falso fundamento.`);
      }
      // Fallback: usa apenas média dos analistas válidos (sem EV+)
      for (const c of combinations) {
        const avg = avgProbById.get(c.id);
        if (typeof avg !== "number") {
          throw new Error(`Juiz Supremo falhou (${err}) e faltou consenso técnico para ${c.id}.`);
        }
        c.aiProb = avg / 100;
        const reasons = reasonsById.get(c.id) ?? [];
        c.reasoning = reasons[0] ?? `${((c.aiProb ?? 0) * 100).toFixed(1)}% (média de ${okAnalysts} analistas — Juiz indisponível)`;
      }
      combinations.sort((a, b) => (b.aiProb ?? 0) - (a.aiProb ?? 0));
      const topCount = Math.max(1, Math.ceil(combinations.length * 0.5));
      combinations.forEach((c, i) => { c.rank = i + 1; c.recommended = i < topCount; });
      aiSummary = `⚠ Juiz Supremo falhou (${err.slice(0, 100)}). Ranking sustentado pela média técnica dos ${okAnalysts} analistas válidos. EV+ não calculado.`;
      opinions.push({ model: JUDGE_MODEL.label, ok: false, content: err });
    }

    // Prefixa o veredito com a auditoria do PIPELINE COMPLETO (Minerador + Fontes + Analistas)
    const minerLine = `- 📡 **Minerador (Perplexity):** ${minerOk ? "**OK** — dados de mercado/xG/desfalques/clima coletados em tempo real" : `**FALHOU** — ${minerError}`}`;
    const analystLine = `- 👥 **Analistas (Matemático/Técnico/Contexto):** ${okAnalysts}/3 válidos${blackHoleCount > 0 ? ` · ${blackHoleCount} declararam BURACO NEGRO` : ""}`;
    const fontesLine = dataAudit.map((a) => `- Jogo ${a.idx} (${a.match}): forma ${a.formReal ? "**real**" : "**ausente**"} · tabela ${a.standingsReal ? "**real**" : "**ausente**"} · H2H ${a.h2hReal ? "**real**" : "**ausente**"} · desfalques ${a.injuriesReal ? "**consultados**" : "**ausentes**"} · base ${a.hasTechnicalBase ? "**técnica OK**" : "**insuficiente**"} · origem **${a.source}**${a.statusMessage ? ` · obs: ${a.statusMessage}` : ""}`).join("\n");
    const auditUi = `**🔎 Pipeline de 3 camadas — fontes desta análise:**\n${minerLine}\n${analystLine}\n${fontesLine}\n\n---\n\n`;
    aiSummary = auditUi + aiSummary;

    return { matches, combinations, aiSummary, opinions };
  });



