import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const ODDS_BASE = "https://api.the-odds-api.com/v4";
const AF_BASE = "https://v3.football.api-sports.io";

// Cache responses aggressively for snappy navigation.
const cache = new Map<string, { ts: number; data: unknown }>();
const TTL_MS = 5 * 60_000; // 5 minutes default

async function cachedFetch(url: string, init?: RequestInit, ttl = TTL_MS): Promise<any> {
  const key = url + JSON.stringify(init?.headers ?? {});
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttl) return hit.data;
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstream ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  cache.set(key, { ts: Date.now(), data });
  return data;
}

// Soccer "key" varies by tournament. We aggregate the most-liked free-tier leagues.
const SOCCER_KEYS = [
  "soccer_epl",
  "soccer_uefa_champs_league",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_brazil_campeonato",
  "soccer_portugal_primeira_liga",
];

export interface MatchSummary {
  id: string;
  sport_key: string;
  league: string;
  home: string;
  away: string;
  commence_time: string;
  bookmakerCount: number;
  // Best odds across all bookmakers
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  // Bet365 odds (0 if unavailable)
  bet365Home: number;
  bet365Draw: number;
  bet365Away: number;
  // Market overround % (lower = better value, <100% = arbitrage)
  marketMargin: number;
  // Implied prob of favorite (highest)
  favoriteProb: number;
  // "balanced" | "favorite" | "heavy_favorite"
  matchType: "balanced" | "favorite" | "heavy_favorite";
  // Arbitrage opportunity?
  isArb: boolean;
  // Live score / status (API-Football). homeGoals/awayGoals are null when no score yet.
  homeGoals?: number | null;
  awayGoals?: number | null;
  statusShort?: string | null; // NS, 1H, HT, 2H, ET, P, FT, AET, PEN, LIVE, etc.
  statusElapsed?: number | null;
  homeLogo?: string | null;
  awayLogo?: string | null;
  leagueLogo?: string | null;
}

function summarizeOdds(bookmakers: any[]): {
  bestHome: number; bestDraw: number; bestAway: number;
  bet365Home: number; bet365Draw: number; bet365Away: number;
  marketMargin: number; favoriteProb: number;
  matchType: "balanced" | "favorite" | "heavy_favorite"; isArb: boolean;
} {
  let bH = 0, bD = 0, bA = 0;
  let b365H = 0, b365D = 0, b365A = 0;
  for (const bm of bookmakers ?? []) {
    const isBet365 = String(bm.key || "").toLowerCase() === "bet365" || String(bm.title || "").toLowerCase().includes("bet365");
    for (const mk of bm.markets ?? []) {
      if (mk.key !== "h2h") continue;
      for (const o of mk.outcomes ?? []) {
        if (o.name === bm._home) { bH = Math.max(bH, o.price); if (isBet365) b365H = o.price; }
        else if (o.name === bm._away) { bA = Math.max(bA, o.price); if (isBet365) b365A = o.price; }
        else if (String(o.name).toLowerCase().includes("draw")) { bD = Math.max(bD, o.price); if (isBet365) b365D = o.price; }
      }
    }
  }
  const ph = bH > 0 ? 1 / bH : 0;
  const pd = bD > 0 ? 1 / bD : 0;
  const pa = bA > 0 ? 1 / bA : 0;
  const total = ph + pd + pa;
  const margin = total > 0 ? (total - 1) * 100 : 0;
  const favP = Math.max(ph, pa);
  const matchType: "balanced" | "favorite" | "heavy_favorite" =
    favP >= 0.65 ? "heavy_favorite" : favP >= 0.5 ? "favorite" : "balanced";
  return {
    bestHome: bH, bestDraw: bD, bestAway: bA,
    bet365Home: b365H, bet365Draw: b365D, bet365Away: b365A,
    marketMargin: margin, favoriteProb: favP, matchType,
    isArb: total > 0 && total < 1,
  };
}

// === Pure fetch from Odds API ===
async function fetchAllMatchesFromApi(): Promise<{ matches: MatchSummary[]; error: string | null }> {
  const key = process.env.ODDS_API_KEY;
  if (!key) return { matches: [], error: "ODDS_API_KEY not configured" };
  const all: MatchSummary[] = [];
  let lastErr: string | null = null;
  const results = await Promise.allSettled(
    SOCCER_KEYS.map(async (sportKey) => {
      const url = `${ODDS_BASE}/sports/${sportKey}/odds/?apiKey=${key}&regions=eu,uk,us&markets=h2h&oddsFormat=decimal`;
      const data = await cachedFetch(url, undefined, 5 * 60_000);
      return (data as any[]).map((m) => {
        const bms = (m.bookmakers ?? []).map((bm: any) => ({ ...bm, _home: m.home_team, _away: m.away_team }));
        const stats = summarizeOdds(bms);
        return {
          id: m.id,
          sport_key: sportKey,
          league: prettyLeague(sportKey),
          home: m.home_team,
          away: m.away_team,
          commence_time: m.commence_time,
          bookmakerCount: m.bookmakers?.length ?? 0,
          ...stats,
        } as MatchSummary;
      });
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else lastErr = (r.reason as Error)?.message ?? String(r.reason);
  }
  all.sort((a, b) => a.commence_time.localeCompare(b.commence_time));
  return { matches: all, error: all.length === 0 ? lastErr : null };
}

// === Fetch today + tomorrow fixtures + Bet365 odds from API-Football (all leagues) ===
async function fetchTodayFromApiFootball(): Promise<{ matches: MatchSummary[]; error: string | null }> {
  const afKey = process.env.API_FOOTBALL_KEY;
  if (!afKey) return { matches: [], error: "API_FOOTBALL_KEY not configured" };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
    const dates = [today, tomorrow];

    const fixtures: any[] = [];
    for (const d of dates) {
      try {
        const fxRes = await cachedFetch(
          `${AF_BASE}/fixtures?date=${d}`,
          { headers: { "x-apisports-key": afKey } },
          3 * 60_000,
        );
        fixtures.push(...((fxRes.response as any[]) ?? []));
      } catch (e) {
        console.warn(`[api-football fixtures ${d}] failed:`, (e as Error).message);
      }
    }

    // Bet365 odds (bookmaker id 8) — cap pages per date to save quota
    const oddsByFixture = new Map<number, any>();
    for (const d of dates) {
      try {
        let page = 1;
        while (page <= 3) {
          const oRes = await cachedFetch(
            `${AF_BASE}/odds?date=${d}&bookmaker=8&page=${page}`,
            { headers: { "x-apisports-key": afKey } },
            15 * 60_000,
          );
          for (const it of (oRes.response as any[]) ?? []) oddsByFixture.set(it.fixture?.id, it);
          const totalPages = oRes.paging?.total ?? 1;
          if (page >= totalPages) break;
          page++;
        }
      } catch (e) {
        console.warn(`[api-football odds ${d}] failed:`, (e as Error).message);
      }
    }

    const matches: MatchSummary[] = fixtures.map((f: any) => {
      const fid = f.fixture?.id;
      const oddsItem = oddsByFixture.get(fid);
      let bH = 0, bD = 0, bA = 0;
      const bm = (oddsItem?.bookmakers ?? []).find((b: any) => b.id === 8 || /bet365/i.test(b.name ?? ""));
      const market = bm?.bets?.find((b: any) => /match winner|1x2|home\/draw\/away/i.test(b.name ?? ""));
      for (const v of market?.values ?? []) {
        const price = parseFloat(v.odd);
        if (!isFinite(price)) continue;
        const lbl = String(v.value).toLowerCase();
        if (lbl === "home" || lbl === "1") bH = price;
        else if (lbl === "away" || lbl === "2") bA = price;
        else if (lbl === "draw" || lbl === "x") bD = price;
      }
      const ph = bH > 0 ? 1 / bH : 0;
      const pd = bD > 0 ? 1 / bD : 0;
      const pa = bA > 0 ? 1 / bA : 0;
      const total = ph + pd + pa;
      const margin = total > 0 ? (total - 1) * 100 : 0;
      const favP = Math.max(ph, pa);
      const matchType: "balanced" | "favorite" | "heavy_favorite" =
        favP >= 0.65 ? "heavy_favorite" : favP >= 0.5 ? "favorite" : "balanced";
      const country = f.league?.country ? `${f.league.country} · ` : "";
      const hg = f.goals?.home;
      const ag = f.goals?.away;
      return {
        id: `af_${fid}`,
        sport_key: `af_${f.league?.id ?? "unknown"}`,
        league: `${country}${f.league?.name ?? "—"}`,
        home: f.teams?.home?.name ?? "—",
        away: f.teams?.away?.name ?? "—",
        commence_time: f.fixture?.date,
        bookmakerCount: oddsItem?.bookmakers?.length ?? 0,
        bestHome: bH, bestDraw: bD, bestAway: bA,
        bet365Home: bH, bet365Draw: bD, bet365Away: bA,
        marketMargin: margin, favoriteProb: favP, matchType,
        isArb: total > 0 && total < 1,
        homeGoals: typeof hg === "number" ? hg : null,
        awayGoals: typeof ag === "number" ? ag : null,
        statusShort: f.fixture?.status?.short ?? null,
        statusElapsed: f.fixture?.status?.elapsed ?? null,
        homeLogo: f.teams?.home?.logo ?? null,
        awayLogo: f.teams?.away?.logo ?? null,
        leagueLogo: f.league?.logo ?? null,
      } as MatchSummary;
    });
    matches.sort((a, b) => a.commence_time.localeCompare(b.commence_time));
    return { matches, error: null };
  } catch (e) {
    return { matches: [], error: (e as Error).message };
  }
}

// === Combine both providers, dedup by team+time ===
async function fetchCombinedMatches(): Promise<{ matches: MatchSummary[]; error: string | null }> {
  const [oddsApi, apiFootball] = await Promise.all([
    fetchAllMatchesFromApi(),
    fetchTodayFromApiFootball(),
  ]);
  const seen = new Map<string, MatchSummary>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const keyFor = (m: MatchSummary) => `${norm(m.home)}_${norm(m.away)}_${m.commence_time.slice(0, 13)}`;
  for (const m of oddsApi.matches) seen.set(keyFor(m), m);
  for (const m of apiFootball.matches) {
    const k = keyFor(m);
    const existing = seen.get(k);
    if (!existing) { seen.set(k, m); continue; }
    if (existing.bet365Home === 0 && m.bet365Home > 0) {
      existing.bet365Home = m.bet365Home;
      existing.bet365Draw = m.bet365Draw;
      existing.bet365Away = m.bet365Away;
    }
  }
  const merged = Array.from(seen.values()).sort((a, b) => a.commence_time.localeCompare(b.commence_time));
  const error = merged.length === 0 ? (oddsApi.error || apiFootball.error) : null;
  return { matches: merged, error };
}

// === Helper: write fresh fetch into cache ===
async function upsertMatchesToCache(matches: MatchSummary[]) {
  if (matches.length === 0) return { count: 0 };
  const supabase = getAdminClient();
  const rows = matches.map((m) => ({
    id: m.id,
    sport_key: m.sport_key,
    league: m.league,
    home: m.home,
    away: m.away,
    commence_time: m.commence_time,
    bookmaker_count: m.bookmakerCount,
    best_home: m.bestHome,
    best_draw: m.bestDraw,
    best_away: m.bestAway,
    bet365_home: m.bet365Home,
    bet365_draw: m.bet365Draw,
    bet365_away: m.bet365Away,
    market_margin: m.marketMargin,
    favorite_prob: m.favoriteProb,
    match_type: m.matchType,
    is_arb: m.isArb,
    home_goals: m.homeGoals ?? null,
    away_goals: m.awayGoals ?? null,
    status_short: m.statusShort ?? null,
    status_elapsed: m.statusElapsed ?? null,
    home_logo: m.homeLogo ?? null,
    away_logo: m.awayLogo ?? null,
    league_logo: m.leagueLogo ?? null,
    updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from("matches_cache").upsert(chunk, { onConflict: "id" });
    if (error) throw error;
  }
  // Cleanup: remove finished games older than 6h
  const cutoff = new Date(Date.now() - 6 * 60 * 60_000).toISOString();
  await supabase.from("matches_cache").delete().lt("commence_time", cutoff);
  return { count: rows.length };
}

// === Read from DB cache — instant ===
export const listFootballMatches = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("matches_cache")
      .select("*")
      .order("commence_time", { ascending: true })
      .limit(1000);
    if (error) throw error;

    const matches: MatchSummary[] = (data ?? []).map((r: any) => ({
      id: r.id,
      sport_key: r.sport_key,
      league: r.league,
      home: r.home,
      away: r.away,
      commence_time: r.commence_time,
      bookmakerCount: r.bookmaker_count,
      bestHome: Number(r.best_home),
      bestDraw: Number(r.best_draw),
      bestAway: Number(r.best_away),
      bet365Home: Number(r.bet365_home),
      bet365Draw: Number(r.bet365_draw),
      bet365Away: Number(r.bet365_away),
      marketMargin: Number(r.market_margin),
      favoriteProb: Number(r.favorite_prob),
      matchType: r.match_type as "balanced" | "favorite" | "heavy_favorite",
      isArb: r.is_arb,
      homeGoals: r.home_goals ?? null,
      awayGoals: r.away_goals ?? null,
      statusShort: r.status_short ?? null,
      statusElapsed: r.status_elapsed ?? null,
      homeLogo: r.home_logo ?? null,
      awayLogo: r.away_logo ?? null,
      leagueLogo: r.league_logo ?? null,
    }));

    const newest = data && data.length > 0
      ? Math.max(...data.map((d: any) => new Date(d.updated_at).getTime()))
      : 0;
    const stale = Date.now() - newest > 10 * 60_000;
    if (matches.length === 0 || stale) {
      try {
        const { matches: fresh, error: fetchErr } = await fetchCombinedMatches();
        if (fresh.length > 0) await upsertMatchesToCache(fresh);
        return {
          matches: fresh.length > 0 ? fresh : matches,
          error: fresh.length === 0 && matches.length === 0 ? fetchErr : null,
          cached: fresh.length === 0,
          refreshedAt: new Date().toISOString(),
        };
      } catch (e) {
        return { matches, error: matches.length === 0 ? (e as Error).message : null, cached: true, refreshedAt: newest ? new Date(newest).toISOString() : null };
      }
    }
    return { matches, error: null as string | null, cached: true, refreshedAt: new Date(newest).toISOString() };
  } catch (e) {
    return { matches: [] as MatchSummary[], error: (e as Error).message, cached: false, refreshedAt: null };
  }
});

// === Public: force refresh (called by cron / manual button) ===
// In-flight dedupe: concurrent callers share one upstream batch (saves API quota).
let _refreshInFlight: Promise<{ ok: boolean; count?: number; refreshedAt?: string; error?: string }> | null = null;
export const refreshMatchesCache = createServerFn({ method: "POST" }).handler(async () => {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => {
    try {
      const { matches: fresh, error } = await fetchCombinedMatches();
      if (fresh.length === 0) return { ok: false, error: error ?? "no matches returned" };
      const { count } = await upsertMatchesToCache(fresh);
      return { ok: true, count, refreshedAt: new Date().toISOString() };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    } finally {
      setTimeout(() => { _refreshInFlight = null; }, 5_000);
    }
  })();
  return _refreshInFlight;
});

// === LIVE-only refresh: 1 single API-Football call (`/fixtures?live=all`) ===
// Updates ONLY score/status fields of existing rows. Designed for pg_cron at ~60s.
let _liveInFlight: Promise<{ ok: boolean; updated?: number; error?: string }> | null = null;
export const refreshLiveMatches = createServerFn({ method: "POST" }).handler(async () => {
  if (_liveInFlight) return _liveInFlight;
  _liveInFlight = (async () => {
    try {
      const afKey = process.env.API_FOOTBALL_KEY;
      if (!afKey) return { ok: false, error: "API_FOOTBALL_KEY not configured" };
      const res = await cachedFetch(
        `${AF_BASE}/fixtures?live=all`,
        { headers: { "x-apisports-key": afKey } },
        20_000,
      );
      const fixtures = (res.response as any[]) ?? [];
      if (fixtures.length === 0) return { ok: true, updated: 0 };

      const supabase = getAdminClient();
      const nowIso = new Date().toISOString();
      const rows = fixtures.map((f: any) => ({
        id: `af_${f.fixture?.id}`,
        sport_key: `af_${f.league?.id ?? "unknown"}`,
        league: `${f.league?.country ? f.league.country + " · " : ""}${f.league?.name ?? "—"}`,
        home: f.teams?.home?.name ?? "—",
        away: f.teams?.away?.name ?? "—",
        commence_time: f.fixture?.date,
        bookmaker_count: 0,
        best_home: 0, best_draw: 0, best_away: 0,
        bet365_home: 0, bet365_draw: 0, bet365_away: 0,
        market_margin: 0, favorite_prob: 0,
        match_type: "balanced" as const,
        is_arb: false,
        home_goals: typeof f.goals?.home === "number" ? f.goals.home : null,
        away_goals: typeof f.goals?.away === "number" ? f.goals.away : null,
        status_short: f.fixture?.status?.short ?? null,
        status_elapsed: f.fixture?.status?.elapsed ?? null,
        home_logo: f.teams?.home?.logo ?? null,
        away_logo: f.teams?.away?.logo ?? null,
        league_logo: f.league?.logo ?? null,
        updated_at: nowIso,
      }));

      // Preserve existing odds when row already exists
      const ids = rows.map((r) => r.id);
      const { data: existing } = await supabase
        .from("matches_cache")
        .select("id, bookmaker_count, best_home, best_draw, best_away, bet365_home, bet365_draw, bet365_away, market_margin, favorite_prob, match_type, is_arb")
        .in("id", ids);
      const byId = new Map<string, any>((existing ?? []).map((r: any) => [r.id, r]));
      for (const r of rows) {
        const prev = byId.get(r.id);
        if (prev) {
          r.bookmaker_count = prev.bookmaker_count;
          r.best_home = prev.best_home;
          r.best_draw = prev.best_draw;
          r.best_away = prev.best_away;
          r.bet365_home = prev.bet365_home;
          r.bet365_draw = prev.bet365_draw;
          r.bet365_away = prev.bet365_away;
          r.market_margin = prev.market_margin;
          r.favorite_prob = prev.favorite_prob;
          r.match_type = prev.match_type;
          r.is_arb = prev.is_arb;
        }
      }
      const { error } = await supabase.from("matches_cache").upsert(rows, { onConflict: "id" });
      if (error) throw error;
      return { ok: true, updated: rows.length };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    } finally {
      setTimeout(() => { _liveInFlight = null; }, 3_000);
    }
  })();
  return _liveInFlight;
});


export interface BookmakerOdds {
  bookmaker: string;
  lastUpdate: string;
  markets: Record<string, { name: string; price: number }[]>;
}

export const getMatchOdds = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ matchId: z.string(), sportKey: z.string() }).parse(d))
  .handler(async ({ data }) => {
    // === API-Football branch (matches with af_ prefix can't be queried on The Odds API) ===
    if (data.sportKey.startsWith("af_") || data.matchId.startsWith("af_")) {
      const afKey = process.env.API_FOOTBALL_KEY;
      const fixtureId = data.matchId.replace(/^af_/, "");

      // Fallback: build odds from the cached match row in DB (no API call needed)
      const fallbackFromCache = async (reason?: string) => {
        const supabase = getAdminClient();
        const { data: row } = await supabase
          .from("matches_cache")
          .select("*")
          .eq("id", data.matchId)
          .maybeSingle();
        if (!row) throw new Error(reason || "Match not found in cache and API-Football unavailable");
        const outcomes: { name: string; price: number }[] = [];
        if (row.bet365_home > 0) outcomes.push({ name: row.home, price: Number(row.bet365_home) });
        if (row.bet365_draw > 0) outcomes.push({ name: "Draw", price: Number(row.bet365_draw) });
        if (row.bet365_away > 0) outcomes.push({ name: row.away, price: Number(row.bet365_away) });
        const bookmakers: BookmakerOdds[] = outcomes.length
          ? [{ bookmaker: "Bet365 (cache)", lastUpdate: row.updated_at ?? "", markets: { h2h: outcomes } }]
          : [];
        return {
          id: row.id,
          home: row.home,
          away: row.away,
          commence_time: row.commence_time,
          league: row.league,
          bookmakers,
          homeGoals: row.home_goals ?? null,
          awayGoals: row.away_goals ?? null,
          statusShort: row.status_short ?? null,
          statusElapsed: row.status_elapsed ?? null,
          homeLogo: row.home_logo ?? null,
          awayLogo: row.away_logo ?? null,
          leagueLogo: row.league_logo ?? null,
        };
      };

      if (!afKey) return fallbackFromCache("API_FOOTBALL_KEY not configured");

      try {
        // Fixture details
        const fxRes = await cachedFetch(
          `${AF_BASE}/fixtures?id=${fixtureId}`,
          { headers: { "x-apisports-key": afKey } },
          3 * 60_000,
        );
        const fixture = (fxRes.response as any[])?.[0];
        if (!fixture) return fallbackFromCache("Fixture not found");

        // Odds for that fixture (all bookmakers available)
        let oddsItem: any = null;
        try {
          const oRes = await cachedFetch(
            `${AF_BASE}/odds?fixture=${fixtureId}`,
            { headers: { "x-apisports-key": afKey } },
            5 * 60_000,
          );
          oddsItem = (oRes.response as any[])?.[0];
        } catch (e) {
          console.warn("[api-football odds] failed, using fixture only:", (e as Error).message);
        }

        const bookmakers: BookmakerOdds[] = (oddsItem?.bookmakers ?? []).map((bm: any) => {
          const markets: Record<string, { name: string; price: number }[]> = {};
          for (const bet of bm.bets ?? []) {
            const name = String(bet.name ?? "").toLowerCase();
            let key: string | null = null;
            if (/match winner|1x2|home\/draw\/away/.test(name)) key = "h2h";
            else if (/goals over\/under|over\/under/.test(name)) key = "totals";
            if (!key) continue;
            markets[key] = (bet.values ?? []).map((v: any) => {
              const lbl = String(v.value);
              let outName = lbl;
              if (key === "h2h") {
                if (/^home$|^1$/i.test(lbl)) outName = fixture.teams?.home?.name ?? "Home";
                else if (/^away$|^2$/i.test(lbl)) outName = fixture.teams?.away?.name ?? "Away";
                else if (/^draw$|^x$/i.test(lbl)) outName = "Draw";
              }
              return { name: outName, price: parseFloat(v.odd) };
            }).filter((o: any) => isFinite(o.price));
          }
          return { bookmaker: bm.name, lastUpdate: oddsItem?.update ?? "", markets };
        });

        // If we got a fixture but no bookmakers, top up with cached Bet365 odds
        if (bookmakers.length === 0) {
          try {
            const cached = await fallbackFromCache();
            if (cached.bookmakers.length > 0) bookmakers.push(...cached.bookmakers);
          } catch { /* ignore */ }
        }

        const country = fixture.league?.country ? `${fixture.league.country} · ` : "";
        return {
          id: data.matchId,
          home: fixture.teams?.home?.name ?? "—",
          away: fixture.teams?.away?.name ?? "—",
          commence_time: fixture.fixture?.date,
          league: `${country}${fixture.league?.name ?? "—"}`,
          bookmakers,
          homeGoals: typeof fixture.goals?.home === "number" ? fixture.goals.home : null,
          awayGoals: typeof fixture.goals?.away === "number" ? fixture.goals.away : null,
          statusShort: fixture.fixture?.status?.short ?? null,
          statusElapsed: fixture.fixture?.status?.elapsed ?? null,
          homeLogo: fixture.teams?.home?.logo ?? null,
          awayLogo: fixture.teams?.away?.logo ?? null,
          leagueLogo: fixture.league?.logo ?? null,
        };
      } catch (e) {
        // 429 / quota / network — degrade gracefully to cache
        console.warn("[api-football fixture] failed, using cache:", (e as Error).message);
        return fallbackFromCache((e as Error).message);
      }
    }

    // === The Odds API branch ===
    const key = process.env.ODDS_API_KEY;
    if (!key) throw new Error("ODDS_API_KEY not configured");

    const url = `${ODDS_BASE}/sports/${data.sportKey}/odds/?apiKey=${key}&regions=eu,uk&markets=h2h,totals&oddsFormat=decimal&eventIds=${data.matchId}`;
    const arr = await cachedFetch(url, undefined, 3 * 60_000);
    const event = (arr as any[])[0];
    if (!event) throw new Error("Match not found or odds unavailable");

    const bookmakers: BookmakerOdds[] = (event.bookmakers ?? []).map((bm: any) => {
      const markets: Record<string, { name: string; price: number }[]> = {};
      for (const mk of bm.markets ?? []) {
        markets[mk.key] = (mk.outcomes ?? []).map((o: any) => ({
          name: o.name + (o.point != null ? ` ${o.point}` : ""),
          price: o.price,
        }));
      }
      return { bookmaker: bm.title, lastUpdate: bm.last_update, markets };
    });

    return {
      id: event.id,
      home: event.home_team,
      away: event.away_team,
      commence_time: event.commence_time,
      league: prettyLeague(data.sportKey),
      bookmakers,
      homeGoals: null,
      awayGoals: null,
      statusShort: null,
      statusElapsed: null,
      homeLogo: null,
      awayLogo: null,
      leagueLogo: null,
    };
  });

export const getLineupStatus = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ home: z.string(), away: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) return { official: false, message: "API_FOOTBALL_KEY not configured", fixtureId: null };

    try {
      // Search for fixture by team name (today/tomorrow window)
      const today = new Date().toISOString().slice(0, 10);
      const url = `${AF_BASE}/fixtures?date=${today}&search=${encodeURIComponent(data.home)}`;
      const res = await cachedFetch(url, { headers: { "x-apisports-key": key } }, 120_000);
      const fixture = (res.response as any[])?.find(
        (f) =>
          f.teams?.home?.name?.toLowerCase().includes(data.home.toLowerCase().split(" ")[0]) ||
          f.teams?.away?.name?.toLowerCase().includes(data.away.toLowerCase().split(" ")[0]),
      );
      if (!fixture) return { official: false, message: "Fixture not found in API-Football", fixtureId: null };

      const lineupUrl = `${AF_BASE}/fixtures/lineups?fixture=${fixture.fixture.id}`;
      const lineups = await cachedFetch(lineupUrl, { headers: { "x-apisports-key": key } }, 60_000);
      const hasLineups = Array.isArray(lineups.response) && lineups.response.length > 0;
      return {
        official: hasLineups,
        message: hasLineups ? "Escalações oficiais confirmadas" : "Escalações ainda não oficiais — Risco Provisório",
        fixtureId: fixture.fixture.id as number,
      };
    } catch (e) {
      return { official: false, message: `Lineup check failed: ${(e as Error).message}`, fixtureId: null };
    }
  });

// ============================================================
// SUPER BLINDAGEM — Pre-match AI analysis
// ============================================================

interface FormGame {
  result: "V" | "E" | "D";
  gf: number; ga: number;
  opponent: string;
  opponentLogo: string | null;
  date: string;
  competition: string;
  competitionLogo: string | null;
  venue: "H" | "A"; // home/away for the team
  status: string; // FT, AET, etc.
}
export interface TeamForm {
  last5: FormGame[];
  gfTotal: number; gaTotal: number;
  wins: number; draws: number; losses: number;
  streak: string; // e.g. "3V" or "2D"
  cleanSheets: number;
  failedToScore: number;
  teamLogo: string | null;
  teamId: number | null;
}

async function findTeamId(teamName: string, afKey: string): Promise<{ id: number | null; logo: string | null }> {
  try {
    const search = await cachedFetch(
      `${AF_BASE}/teams?search=${encodeURIComponent(teamName)}`,
      { headers: { "x-apisports-key": afKey } },
      600_000,
    );
    const teams = (search.response as any[] | undefined) ?? [];
    const direct = teams.find((entry) => teamsLikelyMatch(String(entry?.team?.name ?? ""), teamName));
    const fallback = teams[0];
    const t = (direct ?? fallback)?.team;
    return { id: t?.id ?? null, logo: t?.logo ?? null };
  } catch { return { id: null, logo: null }; }
}

export async function fetchTeamForm(teamName: string, afKey: string): Promise<TeamForm | null> {
  try {
    const { id: teamId, logo: teamLogo } = await findTeamId(teamName, afKey);
    if (!teamId) return null;
    const fixtures = await cachedFetch(
      `${AF_BASE}/fixtures?team=${teamId}&last=10`,
      { headers: { "x-apisports-key": afKey } },
      300_000,
    );
    const allGames: FormGame[] = (fixtures.response as any[]).map((f) => {
      const isHome = f.teams.home.id === teamId;
      const gf = (isHome ? f.goals.home : f.goals.away) ?? 0;
      const ga = (isHome ? f.goals.away : f.goals.home) ?? 0;
      const result: "V" | "E" | "D" = gf > ga ? "V" : gf < ga ? "D" : "E";
      return {
        result, gf, ga,
        opponent: isHome ? f.teams.away.name : f.teams.home.name,
        opponentLogo: isHome ? f.teams.away.logo : f.teams.home.logo,
        date: f.fixture.date,
        competition: f.league?.name ?? "—",
        competitionLogo: f.league?.logo ?? null,
        venue: isHome ? "H" : "A",
        status: f.fixture?.status?.short ?? "FT",
      };
    });
    const last5 = allGames.slice(0, 5);
    // current streak based on last5 (most recent first)
    let streakCount = 0;
    const streakRes = last5[0]?.result;
    if (streakRes) {
      for (const g of last5) {
        if (g.result === streakRes) streakCount++;
        else break;
      }
    }
    return {
      last5,
      gfTotal: last5.reduce((a, g) => a + g.gf, 0),
      gaTotal: last5.reduce((a, g) => a + g.ga, 0),
      wins: last5.filter((g) => g.result === "V").length,
      draws: last5.filter((g) => g.result === "E").length,
      losses: last5.filter((g) => g.result === "D").length,
      streak: streakRes ? `${streakCount}${streakRes}` : "—",
      cleanSheets: last5.filter((g) => g.ga === 0).length,
      failedToScore: last5.filter((g) => g.gf === 0).length,
      teamLogo,
      teamId,
    };
  } catch { return null; }
}

export interface TeamSeasonStats {
  topScorer: { name: string; goals: number; photo: string | null } | null;
  topAssist: { name: string; assists: number; photo: string | null } | null;
  avgGoalsScored: string;
  avgGoalsConceded: string;
  cleanSheetPct: number;
  bttsPct: number; // both teams to score
  over25Pct: number;
}

export async function fetchTeamSeasonStats(teamId: number, leagueId: number, season: number, afKey: string): Promise<TeamSeasonStats | null> {
  try {
    const [statsRes, scorersRes] = await Promise.all([
      cachedFetch(`${AF_BASE}/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`,
        { headers: { "x-apisports-key": afKey } }, 30 * 60_000).catch(() => null),
      cachedFetch(`${AF_BASE}/players?team=${teamId}&season=${season}`,
        { headers: { "x-apisports-key": afKey } }, 60 * 60_000).catch(() => null),
    ]);
    const s = statsRes?.response;
    if (!s) return null;
    const played = s.fixtures?.played?.total ?? 0;
    const cs = s.clean_sheet?.total ?? 0;
    const players = (scorersRes?.response as any[]) ?? [];
    const ranked = players
      .map((p) => ({
        name: p.player?.name,
        photo: p.player?.photo ?? null,
        goals: p.statistics?.[0]?.goals?.total ?? 0,
        assists: p.statistics?.[0]?.goals?.assists ?? 0,
      }))
      .filter((p) => p.name);
    const topScorer = [...ranked].sort((a, b) => b.goals - a.goals)[0];
    const topAssist = [...ranked].sort((a, b) => b.assists - a.assists)[0];
    return {
      topScorer: topScorer && topScorer.goals > 0 ? { name: topScorer.name, goals: topScorer.goals, photo: topScorer.photo } : null,
      topAssist: topAssist && topAssist.assists > 0 ? { name: topAssist.name, assists: topAssist.assists, photo: topAssist.photo } : null,
      avgGoalsScored: s.goals?.for?.average?.total ?? "0",
      avgGoalsConceded: s.goals?.against?.average?.total ?? "0",
      cleanSheetPct: played > 0 ? Math.round((cs / played) * 100) : 0,
      bttsPct: 0, // approximated below if needed
      over25Pct: 0,
    };
  } catch { return null; }
}

export async function fetchInjuries(teamName: string, afKey: string): Promise<string[]> {
  try {
    const search = await cachedFetch(
      `${AF_BASE}/teams?search=${encodeURIComponent(teamName)}`,
      { headers: { "x-apisports-key": afKey } },
      600_000,
    );
    const teams = (search.response as any[] | undefined) ?? [];
    const teamId = teams.find((entry) => teamsLikelyMatch(String(entry?.team?.name ?? ""), teamName))?.team?.id ?? teams[0]?.team?.id;
    if (!teamId) return [];
    const season = new Date().getFullYear();
    const data = await cachedFetch(
      `${AF_BASE}/injuries?team=${teamId}&season=${season}`,
      { headers: { "x-apisports-key": afKey } },
      600_000,
    );
    return (data.response as any[]).slice(0, 8).map((i) => `${i.player?.name} (${i.player?.reason ?? "indisponível"})`);
  } catch { return []; }
}

// === Head-to-head: últimos confrontos diretos ===
export async function fetchH2H(homeId: number, awayId: number, afKey: string): Promise<string[]> {
  try {
    const data = await cachedFetch(
      `${AF_BASE}/fixtures/headtohead?h2h=${homeId}-${awayId}&last=6`,
      { headers: { "x-apisports-key": afKey } },
      30 * 60_000,
    );
    return (data.response as any[]).slice(0, 6).map((f) => {
      const d = new Date(f.fixture.date).toLocaleDateString("pt-BR");
      const h = f.teams.home.name; const a = f.teams.away.name;
      const hg = f.goals.home ?? "-"; const ag = f.goals.away ?? "-";
      const comp = f.league?.name ?? "";
      return `${d} • ${h} ${hg}-${ag} ${a} (${comp})`;
    });
  } catch { return []; }
}

// === Standing/contexto na tabela: posição, pontos, gap p/ G4/Z4/título ===
export interface StandingContext {
  rank: number; points: number; played: number; gd: number;
  form: string | null;
  totalTeams: number;
  leaderPts: number; leaderName: string;
  fourthPts: number | null;
  relegationPts: number | null;
  motivation: string; // texto resumido pra IA
}
export async function fetchStandingContext(teamId: number, leagueId: number, season: number, afKey: string): Promise<StandingContext | null> {
  try {
    const data = await cachedFetch(
      `${AF_BASE}/standings?league=${leagueId}&season=${season}`,
      { headers: { "x-apisports-key": afKey } },
      6 * 3600_000,
    );
    const groups = data.response?.[0]?.league?.standings ?? [];
    const table: any[] = (groups[0] as any[]) ?? [];
    if (!table.length) return null;
    const me = table.find((t) => t.team?.id === teamId);
    if (!me) return null;
    const total = table.length;
    const leader = table[0];
    const fourth = table[3] ?? null;
    // Relegação: assume últimas 4 posições (Brasileirão padrão); pega o primeiro fora da Z4.
    const safe = table[total - 5] ?? null;
    const motivPieces: string[] = [];
    const gapTitle = leader.points - me.points;
    if (me.rank === 1) motivPieces.push("Líder — defendendo título");
    else if (gapTitle <= 6) motivPieces.push(`Briga pelo título (${gapTitle} pts atrás do líder)`);
    if (fourth && me.rank > 4) {
      const gapG4 = fourth.points - me.points;
      if (gapG4 <= 6) motivPieces.push(`Caça vaga na Libertadores/G4 (${gapG4} pts do 4º)`);
    } else if (me.rank <= 4 && me.rank !== 1) {
      motivPieces.push(`Dentro do G4 — segurando vaga continental`);
    }
    if (me.rank >= total - 3) motivPieces.push(`⚠ ZONA DE REBAIXAMENTO — precisa pontuar urgente`);
    else if (safe && me.points - safe.points <= 6) motivPieces.push(`Risco de Z4 (apenas ${me.points - safe.points} pts de folga)`);
    if (!motivPieces.length) motivPieces.push("Cumprindo tabela — sem pressão imediata");
    return {
      rank: me.rank, points: me.points, played: me.all?.played ?? 0, gd: me.goalsDiff ?? 0,
      form: me.form ?? null,
      totalTeams: total,
      leaderPts: leader.points, leaderName: leader.team?.name ?? "líder",
      fourthPts: fourth?.points ?? null,
      relegationPts: safe?.points ?? null,
      motivation: motivPieces.join(" | "),
    };
  } catch { return null; }
}

// === Predictions endpoint da API-Football: opinião do mercado/algoritmo deles ===
export async function fetchPredictions(fixtureId: number, afKey: string): Promise<{
  advice: string | null; winnerName: string | null; winPct: { home: string; draw: string; away: string } | null;
  goalsHome: string | null; goalsAway: string | null; comparison: string | null;
} | null> {
  try {
    const data = await cachedFetch(
      `${AF_BASE}/predictions?fixture=${fixtureId}`,
      { headers: { "x-apisports-key": afKey } },
      30 * 60_000,
    );
    const r = data.response?.[0];
    if (!r) return null;
    const cmp = r.comparison;
    const cmpStr = cmp ? `Forma:${cmp.form?.home}/${cmp.form?.away} | Ataque:${cmp.att?.home}/${cmp.att?.away} | Defesa:${cmp.def?.home}/${cmp.def?.away} | PoissonDist:${cmp.poisson_distribution?.home}/${cmp.poisson_distribution?.away} | H2H:${cmp.h2h?.home}/${cmp.h2h?.away} | Total:${cmp.total?.home}/${cmp.total?.away}` : null;
    return {
      advice: r.predictions?.advice ?? null,
      winnerName: r.predictions?.winner?.name ?? null,
      winPct: r.predictions?.percent ?? null,
      goalsHome: r.predictions?.goals?.home ?? null,
      goalsAway: r.predictions?.goals?.away ?? null,
      comparison: cmpStr,
    };
  } catch { return null; }
}

// Track odds movement: snapshot opening odds the first time we see an event.
const openingOdds = new Map<string, { home: number; draw: number; away: number; ts: number }>();

// Council of AIs: 3 analistas independentes + 1 juiz consolidador.
const COUNCIL_MODELS = [
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { id: "openai/gpt-5", name: "GPT-5" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
];
const JUDGE_MODEL = "openai/gpt-5";

async function callOpenRouter(model: string, system: string, user: string, key: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://bethub.lovable.app",
      "X-Title": "MadureiraBet Super Blindagem",
    },
    body: JSON.stringify({
      model,
      temperature: 0.05,
      max_tokens: 2200,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter ${model} ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

// ===========================================================================
// FALLBACK: pesquisa o dossiê via IA quando a cota do API-Football acabou
// ===========================================================================
async function researchDossierViaAI(
  home: string,
  away: string,
  league: string,
  matchDate: Date,
  orKey: string,
): Promise<{
  homeForm: TeamForm | null;
  awayForm: TeamForm | null;
  homeInj: string[];
  awayInj: string[];
  homeCtx: StandingContext | null;
  awayCtx: StandingContext | null;
  h2h: string[];
  predictions: Awaited<ReturnType<typeof fetchPredictions>>;
  homeSeason: TeamSeasonStats | null;
  awaySeason: TeamSeasonStats | null;
}> {
  const sys = `Você é um pesquisador de futebol. Pesquise dados REAIS e ATUAIS sobre a partida e responda APENAS com um JSON válido, sem texto adicional, sem markdown.`;
  const user = `Pesquise dados sobre: ${home} vs ${away} (${league}) em ${matchDate.toISOString()}.

Retorne JSON com esta estrutura EXATA:
{
  "homeForm": { "last5": [{"result":"W|D|L","gf":0,"ga":0,"opponent":"nome","venue":"H|A"}], "wins":0, "draws":0, "losses":0, "gfTotal":0, "gaTotal":0, "cleanSheets":0, "failedToScore":0, "streak":"3W" },
  "awayForm": { ...mesma estrutura },
  "homeInj": ["Nome (motivo)"],
  "awayInj": ["Nome (motivo)"],
  "homeCtx": { "rank":0, "totalTeams":0, "points":0, "played":0, "gd":0, "form":"WWDLW", "motivation":"texto curto" },
  "awayCtx": { ...mesma estrutura },
  "h2h": ["DD/MM/AAAA: Time A 2-1 Time B (Competição)"],
  "predictions": { "winnerName":"nome ou null", "winPct":{"home":"45%","draw":"25%","away":"30%"}, "goalsHome":1.5, "goalsAway":1.2, "advice":"texto", "comparison":"texto" },
  "homeSeason": { "avgGoalsScored":1.5, "avgGoalsConceded":1.0, "cleanSheetPct":30, "topScorer":{"name":"nome","goals":10}, "topAssist":{"name":"nome","assists":5} },
  "awaySeason": { ...mesma estrutura }
}

Use null para campos desconhecidos. Pesquise dados REAIS, não invente.`;

  const raw = await callOpenRouter("perplexity/sonar", sys, user, orKey).catch(() =>
    callOpenRouter("openai/gpt-4o-mini", sys, user, orKey),
  );

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI research did not return JSON");
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    homeForm: parsed.homeForm ?? null,
    awayForm: parsed.awayForm ?? null,
    homeInj: Array.isArray(parsed.homeInj) ? parsed.homeInj : [],
    awayInj: Array.isArray(parsed.awayInj) ? parsed.awayInj : [],
    homeCtx: parsed.homeCtx ?? null,
    awayCtx: parsed.awayCtx ?? null,
    h2h: Array.isArray(parsed.h2h) ? parsed.h2h : [],
    predictions: parsed.predictions ?? null,
    homeSeason: parsed.homeSeason ?? null,
    awaySeason: parsed.awaySeason ?? null,
  };
}

export const analyzeMatch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ matchId: z.string(), sportKey: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const orKey = process.env.OPENROUTER_API_KEY;
    const afKey = process.env.API_FOOTBALL_KEY;
    if (!orKey) throw new Error("OPENROUTER_API_KEY não configurada");

    const match = await getMatchOdds({ data });
    const now = new Date();
    const matchDate = new Date(match.commence_time);
    const isPast = matchDate.getTime() < now.getTime() - 2 * 60 * 60 * 1000;

    const best = { home: 0, draw: 0, away: 0 };
    for (const bm of match.bookmakers) {
      for (const o of bm.markets.h2h ?? []) {
        if (o.name === match.home && o.price > best.home) best.home = o.price;
        else if (o.name === match.away && o.price > best.away) best.away = o.price;
        else if (o.name.toLowerCase().includes("draw") && o.price > best.draw) best.draw = o.price;
      }
    }
    if (!openingOdds.has(match.id) && best.home > 0) openingOdds.set(match.id, { ...best, ts: Date.now() });
    const opening = openingOdds.get(match.id) ?? best;

    // === CACHE FIRST: tenta carregar dossiê salvo ===
    const admin = getAdminClient();
    let homeForm: TeamForm | null = null;
    let awayForm: TeamForm | null = null;
    let homeInj: string[] = [];
    let awayInj: string[] = [];
    let homeCtx: StandingContext | null = null;
    let awayCtx: StandingContext | null = null;
    let h2h: string[] = [];
    let predictions: Awaited<ReturnType<typeof fetchPredictions>> = null;
    let homeSeason: TeamSeasonStats | null = null;
    let awaySeason: TeamSeasonStats | null = null;
    let dossierSource: "api-football" | "cache" | "ai-research" = "api-football";

    const { data: cached } = await admin
      .from("match_dossier_cache")
      .select("dossier_data, fetched_at")
      .eq("match_id", match.id)
      .maybeSingle();

    // Cache válido por 6h (dados de jogo mudam pouco no curto prazo)
    const CACHE_TTL_MS = 6 * 3600_000;
    const cacheValid = cached && (Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS);

    if (cacheValid) {
      const d = cached.dossier_data as any;
      homeForm = d.homeForm ?? null;
      awayForm = d.awayForm ?? null;
      homeInj = d.homeInj ?? [];
      awayInj = d.awayInj ?? [];
      homeCtx = d.homeCtx ?? null;
      awayCtx = d.awayCtx ?? null;
      h2h = d.h2h ?? [];
      predictions = d.predictions ?? null;
      homeSeason = d.homeSeason ?? null;
      awaySeason = d.awaySeason ?? null;
      dossierSource = "cache";
      console.log("[analyzeMatch] using cached dossier for", match.id);
    } else {
      // === Tenta API-Football ===
      let apiFootballOk = false;
      if (afKey) {
        try {
          [homeForm, awayForm, homeInj, awayInj] = await Promise.all([
            fetchTeamForm(match.home, afKey),
            fetchTeamForm(match.away, afKey),
            fetchInjuries(match.home, afKey),
            fetchInjuries(match.away, afKey),
          ]);
          apiFootballOk = true;
        } catch (e) {
          console.warn("[analyzeMatch] API-Football base failed:", (e as Error).message);
        }
      }

      if (apiFootballOk && (data.matchId.startsWith("af_") || data.sportKey.startsWith("af_"))) {
        try {
          const fixtureId = data.matchId.replace(/^af_/, "");
          const fxRes = await cachedFetch(
            `${AF_BASE}/fixtures?id=${fixtureId}`,
            { headers: { "x-apisports-key": afKey! } },
            5 * 60_000,
          );
          const fx = (fxRes.response as any[])?.[0];
          const leagueId: number | null = fx?.league?.id ?? null;
          const season: number = fx?.league?.season ?? new Date().getFullYear();
          const homeId: number | null = fx?.teams?.home?.id ?? null;
          const awayId: number | null = fx?.teams?.away?.id ?? null;

          const [h2hRes, predRes, hCtx, aCtx, hSeason, aSeason] = await Promise.all([
            homeId && awayId ? fetchH2H(homeId, awayId, afKey!) : Promise.resolve([] as string[]),
            fetchPredictions(Number(fixtureId), afKey!),
            leagueId && homeId ? fetchStandingContext(homeId, leagueId, season, afKey!) : Promise.resolve(null),
            leagueId && awayId ? fetchStandingContext(awayId, leagueId, season, afKey!) : Promise.resolve(null),
            leagueId && homeId ? fetchTeamSeasonStats(homeId, leagueId, season, afKey!) : Promise.resolve(null),
            leagueId && awayId ? fetchTeamSeasonStats(awayId, leagueId, season, afKey!) : Promise.resolve(null),
          ]);
          h2h = h2hRes;
          predictions = predRes;
          homeCtx = hCtx; awayCtx = aCtx;
          homeSeason = hSeason; awaySeason = aSeason;
        } catch (e) {
          console.warn("[analyzeMatch enrich] failed, falling back to AI research:", (e as Error).message);
          apiFootballOk = false;
        }
      }

      // === FALLBACK: cota esgotada ou API falhou — pesquisa via IA ===
      if (!apiFootballOk) {
        dossierSource = "ai-research";
        try {
          const researched = await researchDossierViaAI(match.home, match.away, match.league, matchDate, orKey);
          homeForm = researched.homeForm;
          awayForm = researched.awayForm;
          homeInj = researched.homeInj;
          awayInj = researched.awayInj;
          homeCtx = researched.homeCtx;
          awayCtx = researched.awayCtx;
          h2h = researched.h2h;
          predictions = researched.predictions;
          homeSeason = researched.homeSeason;
          awaySeason = researched.awaySeason;
          console.log("[analyzeMatch] dossier researched via AI for", match.id);
        } catch (e) {
          console.warn("[analyzeMatch] AI research also failed:", (e as Error).message);
        }
      }
    }

    const formStr = (f: TeamForm | null) => f ? `${f.last5.map((g) => `${g.result}(${g.gf}-${g.ga} vs ${g.opponent}${g.venue === "H" ? " casa" : " fora"})`).join(" | ")} → Saldo ${f.gfTotal}-${f.gaTotal}, ${f.wins}V/${f.draws}E/${f.losses}D, sequência ${f.streak}, ${f.cleanSheets} CS, ${f.failedToScore} sem marcar` : "indisponível";
    const ctxStr = (teamName: string, c: StandingContext | null) => c
      ? `${teamName}: ${c.rank}º/${c.totalTeams} • ${c.points} pts em ${c.played} jogos • SG ${c.gd >= 0 ? "+" : ""}${c.gd} • Forma oficial: ${c.form ?? "—"}\n  → Motivação: ${c.motivation}`
      : `${teamName}: contexto de tabela indisponível`;
    const seasonStr = (s: TeamSeasonStats | null) => s
      ? `${s.avgGoalsScored} gols/jogo feitos, ${s.avgGoalsConceded} sofridos • CS ${s.cleanSheetPct}% • Artilheiro: ${s.topScorer ? `${s.topScorer.name} (${s.topScorer.goals}g)` : "—"} • Garçom: ${s.topAssist ? `${s.topAssist.name} (${s.topAssist.assists}a)` : "—"}`
      : "indisponível";
    const predStr = predictions
      ? `Algoritmo API-Football: vencedor=${predictions.winnerName ?? "—"} • Probabilidades: Casa ${predictions.winPct?.home ?? "—"} / Empate ${predictions.winPct?.draw ?? "—"} / Fora ${predictions.winPct?.away ?? "—"} • Gols esperados: ${predictions.goalsHome ?? "?"} x ${predictions.goalsAway ?? "?"} • Conselho: "${predictions.advice ?? "—"}" • Comparação interna: ${predictions.comparison ?? "—"}`
      : "indisponível";

    const dossier = `### 🛡️ DOSSIÊ COMPLETO — ${match.home} vs ${match.away}

[TEMPORAL]
- Hoje: ${now.toLocaleString("pt-BR")}
- Jogo: ${matchDate.toLocaleString("pt-BR")}
- Status: ${isPast ? "⚠ JÁ OCORREU" : "Pré-Jogo"}

[CONTEXTO DA COMPETIÇÃO]
- Liga: ${match.league}

[SITUAÇÃO NA TABELA — motivação real]
- ${ctxStr(match.home, homeCtx)}
- ${ctxStr(match.away, awayCtx)}

[OPINIÃO ALGORÍTMICA — API-Football Predictions]
- ${predStr}

[FORMA — últimos 5 jogos detalhados]
- ${match.home}: ${formStr(homeForm)}
- ${match.away}: ${formStr(awayForm)}

[ESTATÍSTICAS DA TEMPORADA]
- ${match.home}: ${seasonStr(homeSeason)}
- ${match.away}: ${seasonStr(awaySeason)}

[CONFRONTOS DIRETOS — H2H últimos 6]
${h2h.length ? h2h.map((l) => `- ${l}`).join("\n") : "- sem histórico recente"}

[DESFALQUES E LESÕES]
- ${match.home}: ${homeInj.length ? homeInj.join(", ") : "nenhum reportado"}
- ${match.away}: ${awayInj.length ? awayInj.join(", ") : "nenhum reportado"}`;

    const analystSystem = `Você é um SCOUT TÉCNICO PROFISSIONAL de futebol — nível olheiro de clube europeu. Sua função NÃO é palpitar; é dissecar o jogo tecnicamente como um analista de desempenho faria para a comissão técnica.

🚫 PROIBIDO ABSOLUTO:
- Mencionar odds, mercado, valor, bookmaker, EV, probabilidade implícita do mercado. Você é CEGO para isso de propósito.
- Frases vagas tipo "o time está bem", "jogo difícil", "tudo pode acontecer". CADA afirmação precisa de NÚMERO ou FATO concreto extraído do dossiê.
- Análise genérica sem citar nomes de jogadores, posições na tabela, placares específicos do H2H, gols marcados/sofridos.
- Inventar dados que não estão no dossiê. Se faltar info, declare "dado ausente".

HIERARQUIA OBRIGATÓRIA DA ANÁLISE:
1. Motivação competitiva real e urgência na tabela.
2. Forma recente contextualizada (mandante em casa / visitante fora).
3. Desfalques e impacto estrutural.
4. Estatísticas de temporada e H2H.
5. Predição algorítmica do dossiê apenas como apoio secundário, nunca como base principal.

✅ OBRIGATÓRIO — cada seção deve ter pelo menos 4-6 frases DENSAS com números:

## 🏟️ Raio-X do Mandante (${'${'}match.home${'}'})
- Posição EXATA na tabela + pontos + jogos disputados + situação (briga título / meio / Z4).
- Aproveitamento em casa nos últimos 5 (ex: "3V-1E-1D, 8 gols pró, 4 contra = 1.6 GM/jogo, 0.8 GS/jogo").
- Estilo de jogo dominante segundo as estatísticas da temporada (posse, finalizações, pressão alta?).
- Artilheiro citado pelo nome + número de gols.
- Desfalques: PESO de cada um (titular absoluto? artilheiro? goleiro?). Se "nenhum reportado", diga isso.
- O QUE este time PRECISA deste jogo (3 pts vitais? salvação? sequência de invencibilidade?).

## ✈️ Raio-X do Visitante (${'${'}match.away${'}'})
- Mesmo nível de detalhe acima, focando em desempenho FORA de casa.
- Histórico viajando: vence fora? Empata muito? Sofre muitos gols como visitante?

## 🥊 Confronto Direto (H2H)
- Cite os placares EXATOS dos últimos 6 confrontos do dossiê.
- Quem domina historicamente? Padrão de gols (jogos com muitos gols? truncados?).
- Última vitória de cada lado e em que condição.

## 🧠 Leitura Tática do Jogo
- Choque de estilos: como o ataque do mandante se comporta vs a defesa do visitante (use médias da temporada).
- Onde está o desequilíbrio? (ataque casa muito > defesa fora? Goleiro reserva?)
- Cenário de jogo mais provável (truncado? aberto? mandante pressiona?).

## 🧷 Cadeia de Evidências
- Liste pelo menos 6 evidências objetivas em bullets curtos, cada uma com um número ou fato exato do dossiê.
- Cada evidência deve explicar por que favorece casa, empate, fora, gols ou ambas marcam.

## 🧮 Probabilidades Estimadas POR VOCÊ
- Vitória ${'${'}match.home${'}'}: __%
- Empate: __%
- Vitória ${'${'}match.away${'}'}: __%
- Total Gols Esperado: __
- Ambas Marcam: SIM/NÃO + %
JUSTIFIQUE cada % com 1 frase técnica baseada nos dados.

## 🎯 Veredito Técnico
- Resultado mais provável + mercado de maior confiança (1X2, Over/Under, BTTS, Handicap).
- POR QUÊ em 3 bullets concretos com citação numérica do dossiê.

## 💪 Confiança Técnica (1-5)
- Nota + 1 frase explicando o que aumentaria/diminuiria a confiança.

 Tom: frio, cirúrgico, técnico de futebol. ZERO floreio. SEM emoji desnecessário fora dos cabeçalhos. Cite NÚMEROS o tempo todo.

REGRA FINAL: se você escrever qualquer referência a odds, mercado, casas, linha ou preço, sua resposta é inválida.`;

    const analystUser = `${dossier}\n\n### TAREFA: dissecação técnica COMPLETA do jogo acima. Cite números, nomes e fatos do dossiê em CADA afirmação. Você NÃO vê odds — análise puramente esportiva. Priorize necessidade competitiva, forma, desfalques, H2H e encaixe tático. Mínimo 900 palavras.`;

    // === SALVA DOSSIÊ NO CACHE (se foi recém-montado) ===
    if (dossierSource !== "cache") {
      try {
        await admin.from("match_dossier_cache").upsert({
          match_id: match.id,
          dossier_text: dossier,
          dossier_data: { homeForm, awayForm, homeInj, awayInj, homeCtx, awayCtx, h2h, predictions, homeSeason, awaySeason },
          commence_time: match.commence_time,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        console.log(`[analyzeMatch] dossier cached (source=${dossierSource}) for ${match.id}`);
      } catch (e) {
        console.warn("[analyzeMatch] failed to cache dossier:", (e as Error).message);
      }
    }

    // 1) Conselho — 3 análises em paralelo
    const councilResults = await Promise.allSettled(
      COUNCIL_MODELS.map((m) => callOpenRouter(m.id, analystSystem, analystUser, orKey)),
    );
    const opinions = councilResults.map((r, i) => ({
      model: COUNCIL_MODELS[i].name,
      ok: r.status === "fulfilled",
      content: r.status === "fulfilled" ? r.value : `❌ Erro: ${(r.reason as Error).message}`,
    }));

    const goodOpinions = opinions.filter((o) => o.ok);
    if (goodOpinions.length === 0) throw new Error("Todos os analistas falharam. Verifique sua API OpenRouter.");

    // 2) Juiz — consolida
    const judgeSystem = `Você é o JUIZ-CHEFE de um conselho de 3 scouts técnicos profissionais (Claude Sonnet 4.5, GPT-5 e Gemini 2.5 Pro — três cérebros independentes).
Sua função: cruzar os 3 pareceres técnicos e produzir UMA decisão final auditada e DENSA.

🚫 PROIBIDO: citar odds, mercado, valor, bookmaker, EV. Análise puramente esportiva.

✅ OBRIGATÓRIO:
- Para CADA conclusão, cite QUAL analista disse o quê (ex: "Claude e Gemini convergem em 55% mandante; GPT-4o vê 48%").
- Se há CONSENSO em pelo menos 2 dos 3 → confiança ALTA. Siga a maioria.
- Se TODOS divergem → confiança BAIXA, declare incerteza explicitamente.
- Reconcilie probabilidades fazendo MÉDIA ponderada e mostrando o cálculo.
- Liste no mínimo 3 RISCOS técnicos concretos (não genéricos).
- Se algum analista mencionar odds/mercado, descarte esse trecho e registre que ele violou a regra cega.
- Sua decisão final deve se apoiar primeiro em motivação competitiva, forma, desfalques e encaixe tático.

Estrutura obrigatória (markdown denso):

## 🧑‍⚖️ Veredito Final
Frase única e direta: qual resultado/mercado a Comissão decide.

## 📊 Mapa de Consenso vs Divergência
Tabela mental: em que CADA analista concordou, em que divergiram, com nome citado.

## 🧮 Probabilidades Consolidadas
- Casa: __% (média dos 3, mostre os 3 valores)
- Empate: __%
- Fora: __%
- Total Gols: __
- BTTS: __%

## 🎯 Resultado / Mercado Técnico Mais Forte
Escolha principal (1X2 / Over-Under / BTTS / Handicap / Dupla Chance) + 3 razões TÉCNICAS concretas com número.

## 🔍 Justificativa Técnica Detalhada
Mínimo 4 parágrafos explicando POR QUÊ, citando: tabela, forma, H2H, desfalques, estilos.

## 💪 Confiança Final (1-5)
Nota + justificativa em 1 frase.

## ⚠️ Riscos Concretos
- Risco 1 (com fato do dossiê)
- Risco 2
- Risco 3

Tom: juiz técnico, frio, numérico. Mínimo 700 palavras.`;

    const judgeUser = `DOSSIÊ ORIGINAL:
${dossier}

PARECERES DOS 3 ANALISTAS:

${goodOpinions.map((o, i) => `--- ANALISTA ${i + 1} (${o.model}) ---\n${o.content}`).join("\n\n")}

Consolide agora.`;

    const verdict = await callOpenRouter(JUDGE_MODEL, judgeSystem, judgeUser, orKey);

    return {
      verdict,
      opinions,
      isPast,
      opening,
      current: best,
      homeForm,
      awayForm,
      homeInj,
      awayInj,
      homeCtx,
      awayCtx,
      h2h,
      predictions,
      homeSeason,
      awaySeason,
      home: match.home,
      away: match.away,
    };
  });

// ============================================================
// MATCH CONTEXT — All flashscore-style data in ONE call
// ============================================================

export interface LineupPlayer {
  number: number | null;
  name: string;
  pos: string | null; // G, D, M, F
  photo: string | null;
}
export interface TeamLineup {
  formation: string | null;
  coach: string | null;
  startXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface MatchContext {
  fixture: { id: number; date: string; venue: string; city: string; referee: string | null; leagueName: string; leagueLogo: string | null; round: string } | null;
  homeForm: TeamForm | null;
  awayForm: TeamForm | null;
  homeStats: TeamSeasonStats | null;
  awayStats: TeamSeasonStats | null;
  homeInj: string[];
  awayInj: string[];
  h2h: Array<{ date: string; home: string; away: string; score: string; winner: "home" | "away" | "draw"; competition: string }>;
  h2hSummary: { homeWins: number; awayWins: number; draws: number };
  standings: Array<{ rank: number; team: string; teamLogo: string | null; played: number; win: number; draw: number; lose: number; gf: number; ga: number; gd: number; points: number; form: string }>;
  homeRank: number | null;
  awayRank: number | null;
  lineupOfficial: boolean;
  lineupProbable: boolean; // true se vem do último jogo (não oficial ainda)
  homeLineup: TeamLineup | null;
  awayLineup: TeamLineup | null;
  tv: string[];
  status: "ok" | "partial" | "unavailable";
  statusMessage: string | null;
  source: "api-football" | "ai-research" | "cache" | "unavailable";
}

function normalizeTeamToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|sc|ac|ec|cf|cd|rs|club|futebol|football)\b/g, " ")
    .replace(/\b(women|woman|ladies|feminino|fem|women's|wfc|w)\b/g, " women ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(normalizeTeamToken(value).split(/\s+/).filter(Boolean));
}

function teamsLikelyMatch(left: string, right: string) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  if (shared === 0) return false;
  const hasWomenSignal = a.has("women") || b.has("women");
  return hasWomenSignal ? shared >= 1 : shared >= Math.min(2, Math.min(a.size, b.size));
}

async function findFixture(home: string, away: string, afKey: string) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  for (const date of [today, tomorrow, yest]) {
    try {
      const url = `${AF_BASE}/fixtures?date=${date}`;
      const res = await cachedFetch(url, { headers: { "x-apisports-key": afKey } }, 10 * 60_000);
      const fx = (res.response as any[])?.find((f) => {
        const fixtureHome = String(f.teams.home.name ?? "");
        const fixtureAway = String(f.teams.away.name ?? "");
        return (
          (teamsLikelyMatch(fixtureHome, home) && teamsLikelyMatch(fixtureAway, away)) ||
          (teamsLikelyMatch(fixtureHome, away) && teamsLikelyMatch(fixtureAway, home))
        );
      });
      if (fx) return fx;
    } catch {}
  }
  return null;
}

function parseLineup(raw: any): TeamLineup | null {
  if (!raw) return null;
  const mapPlayer = (p: any): LineupPlayer => ({
    number: p?.player?.number ?? p?.number ?? null,
    name: p?.player?.name ?? p?.name ?? "—",
    pos: p?.player?.pos ?? p?.pos ?? null,
    photo: p?.player?.photo ?? null,
  });
  const startXI = (raw.startXI ?? []).map(mapPlayer);
  const substitutes = (raw.substitutes ?? []).map(mapPlayer);
  return {
    formation: raw.formation ?? null,
    coach: raw.coach?.name ?? null,
    startXI, substitutes,
  };
}

// Fetch most recent finished fixture lineup for a team (used as "provável")
async function fetchProbableLineup(teamId: number, afKey: string): Promise<TeamLineup | null> {
  try {
    const past = await cachedFetch(
      `${AF_BASE}/fixtures?team=${teamId}&last=5`,
      { headers: { "x-apisports-key": afKey } },
      30 * 60_000,
    );
    const fixtures = (past.response as any[]) ?? [];
    for (const fx of fixtures) {
      const fid = fx.fixture?.id;
      if (!fid) continue;
      const lu = await cachedFetch(
        `${AF_BASE}/fixtures/lineups?fixture=${fid}`,
        { headers: { "x-apisports-key": afKey } },
        60 * 60_000,
      ).catch(() => null);
      const teamLineup = (lu?.response as any[] ?? []).find((l: any) => l?.team?.id === teamId);
      if (teamLineup && (teamLineup.startXI?.length ?? 0) > 0) {
        return parseLineup(teamLineup);
      }
    }
  } catch {}
  return null;
}

const CONTEXT_TTL_MS = 6 * 3600_000; // 6h

function contextCacheKey(home: string, away: string) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return `${norm(home)}__vs__${norm(away)}`;
}

async function readContextCache(home: string, away: string): Promise<{ payload: MatchContext; updatedAt: string } | null> {
  try {
    const sb = getAdminClient();
    const { data: row } = await sb
      .from("match_context_cache")
      .select("payload, updated_at")
      .eq("cache_key", contextCacheKey(home, away))
      .maybeSingle();
    if (!row) return null;
    return { payload: row.payload as MatchContext, updatedAt: row.updated_at as string };
  } catch { return null; }
}

async function writeContextCache(home: string, away: string, payload: MatchContext) {
  try {
    const sb = getAdminClient();
    await sb.from("match_context_cache").upsert({
      cache_key: contextCacheKey(home, away),
      home, away,
      payload: payload as any,
      status: payload.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: "cache_key" });
  } catch (e) {
    console.warn("[match_context_cache write]", (e as Error).message);
  }
}

export const getMatchContext = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ home: z.string(), away: z.string() }).parse(d))
  .handler(async ({ data }): Promise<MatchContext> => {
    // 1) Tenta cache do banco antes de qualquer API
    const cached = await readContextCache(data.home, data.away);
    if (cached && cached.payload?.status === "ok") {
      const age = Date.now() - new Date(cached.updatedAt).getTime();
      if (age < CONTEXT_TTL_MS) return cached.payload;
    }

    const afKey = process.env.API_FOOTBALL_KEY;
    const empty: MatchContext = {
      fixture: null, homeForm: null, awayForm: null, homeStats: null, awayStats: null,
      homeInj: [], awayInj: [],
      h2h: [], h2hSummary: { homeWins: 0, awayWins: 0, draws: 0 },
      standings: [], homeRank: null, awayRank: null,
      lineupOfficial: false, lineupProbable: false, homeLineup: null, awayLineup: null,
      tv: [], status: "unavailable", statusMessage: null, source: "unavailable",
    };
    if (!afKey) {
      if (cached) return cached.payload;
      return { ...empty, statusMessage: "API de estatísticas (API-Football) não configurada — habilite a chave para ver dados completos." };
    }

    try {
      const fx = await findFixture(data.home, data.away, afKey);
      const fixtureId = fx?.fixture?.id;
      const leagueId = fx?.league?.id;
      const season = fx?.league?.season ?? new Date().getFullYear();
      const homeId = fx?.teams?.home?.id;
      const awayId = fx?.teams?.away?.id;

      // Run ALL context queries in PARALLEL
      const [homeForm, awayForm, homeInj, awayInj, h2hRes, standingsRes, lineupRes, homeStats, awayStats] = await Promise.all([
        fetchTeamForm(data.home, afKey),
        fetchTeamForm(data.away, afKey),
        fetchInjuries(data.home, afKey),
        fetchInjuries(data.away, afKey),
        homeId && awayId
          ? cachedFetch(`${AF_BASE}/fixtures/headtohead?h2h=${homeId}-${awayId}&last=10`, { headers: { "x-apisports-key": afKey } }, 30 * 60_000).catch(() => null)
          : Promise.resolve(null),
        leagueId
          ? cachedFetch(`${AF_BASE}/standings?league=${leagueId}&season=${season}`, { headers: { "x-apisports-key": afKey } }, 30 * 60_000).catch(() => null)
          : Promise.resolve(null),
        fixtureId
          ? cachedFetch(`${AF_BASE}/fixtures/lineups?fixture=${fixtureId}`, { headers: { "x-apisports-key": afKey } }, 5 * 60_000).catch(() => null)
          : Promise.resolve(null),
        homeId && leagueId ? fetchTeamSeasonStats(homeId, leagueId, season, afKey) : Promise.resolve(null),
        awayId && leagueId ? fetchTeamSeasonStats(awayId, leagueId, season, afKey) : Promise.resolve(null),
      ]);

      const h2hAll = (h2hRes?.response as any[] ?? []);
      const h2h = h2hAll.slice(0, 10).map((f: any) => {
        const hg = f.goals.home ?? 0, ag = f.goals.away ?? 0;
        return {
          date: f.fixture.date,
          home: f.teams.home.name,
          away: f.teams.away.name,
          score: `${hg}-${ag}`,
          winner: hg > ag ? "home" as const : ag > hg ? "away" as const : "draw" as const,
          competition: f.league?.name ?? "—",
        };
      });
      // h2h summary from perspective of THIS match's home/away
      let hWins = 0, aWins = 0, dr = 0;
      for (const g of h2hAll) {
        const hg = g.goals.home ?? 0, ag = g.goals.away ?? 0;
        if (hg === ag) { dr++; continue; }
        const winnerId = hg > ag ? g.teams.home.id : g.teams.away.id;
        if (winnerId === homeId) hWins++;
        else if (winnerId === awayId) aWins++;
      }

      const tableRows = standingsRes?.response?.[0]?.league?.standings?.[0] ?? [];
      const standings = tableRows.map((row: any) => ({
        rank: row.rank,
        team: row.team.name,
        teamLogo: row.team.logo ?? null,
        played: row.all.played,
        win: row.all.win,
        draw: row.all.draw,
        lose: row.all.lose,
        gf: row.all.goals?.for ?? 0,
        ga: row.all.goals?.against ?? 0,
        gd: row.goalsDiff,
        points: row.points,
        form: row.form ?? "",
      }));
      const homeRank = standings.find((s: any) => s.team.toLowerCase().includes(data.home.toLowerCase().split(" ")[0]))?.rank ?? null;
      const awayRank = standings.find((s: any) => s.team.toLowerCase().includes(data.away.toLowerCase().split(" ")[0]))?.rank ?? null;

      const officialLineups = (lineupRes?.response as any[] ?? []);
      const lineupOfficial = officialLineups.length > 0;
      let homeLineup: TeamLineup | null = null;
      let awayLineup: TeamLineup | null = null;
      if (lineupOfficial) {
        homeLineup = parseLineup(officialLineups.find((l: any) => l?.team?.id === homeId)) ?? null;
        awayLineup = parseLineup(officialLineups.find((l: any) => l?.team?.id === awayId)) ?? null;
      }
      // If officials missing, fetch probable from last fixture (most recent XI)
      if (!homeLineup && homeId) homeLineup = await fetchProbableLineup(homeId, afKey);
      if (!awayLineup && awayId) awayLineup = await fetchProbableLineup(awayId, afKey);
      const lineupProbable = !lineupOfficial && (!!homeLineup || !!awayLineup);

      // Status
      const haveAnything = !!fx || !!homeForm || !!awayForm || standings.length > 0 || h2h.length > 0;
      const hasCoreTechnicalBase = !!(homeForm && awayForm && standings.length > 0);
      const status: MatchContext["status"] = haveAnything
        ? (hasCoreTechnicalBase ? "ok" : "partial")
        : "unavailable";
      const statusMessage = status === "unavailable"
        ? "Base técnica indisponível no momento para este jogo."
        : status === "partial"
          ? "Base técnica parcial: faltam peças importantes para uma leitura confiável."
          : null;

      if (!hasCoreTechnicalBase) {
        if (cached) return cached.payload; // serve stale antes de devolver vazio
        return { ...empty, status: haveAnything ? "partial" : "unavailable", statusMessage, source: "unavailable" };
      }

      const result: MatchContext = {
        fixture: fx ? {
          id: fx.fixture.id,
          date: fx.fixture.date,
          venue: fx.fixture.venue?.name ?? "—",
          city: fx.fixture.venue?.city ?? "—",
          referee: fx.fixture.referee ?? null,
          leagueName: fx.league?.name ?? "—",
          leagueLogo: fx.league?.logo ?? null,
          round: fx.league?.round ?? "—",
        } : null,
        homeForm, awayForm, homeStats, awayStats, homeInj, awayInj,
        h2h, h2hSummary: { homeWins: hWins, awayWins: aWins, draws: dr },
        standings, homeRank, awayRank,
        lineupOfficial, lineupProbable, homeLineup, awayLineup,
        tv: [], status, statusMessage, source: "api-football",
      };
      // Persiste no banco pra próximas chamadas não baterem na API
      await writeContextCache(data.home, data.away, result);
      return result;
    } catch (e) {
      const msg = (e as Error).message;
      console.warn("[context] failed:", msg);
      if (cached) return cached.payload; // fallback: cache stale
      return { ...empty, statusMessage: /429|quota|rate/i.test(msg) ? "Cota da API atingida — dados temporariamente indisponíveis." : `Erro ao carregar contexto: ${msg}` };
    }
  });

function prettyLeague(key: string): string {
  const map: Record<string, string> = {
    soccer_epl: "Premier League",
    soccer_uefa_champs_league: "Champions League",
    soccer_spain_la_liga: "La Liga",
    soccer_italy_serie_a: "Serie A",
    soccer_germany_bundesliga: "Bundesliga",
    soccer_france_ligue_one: "Ligue 1",
    soccer_brazil_campeonato: "Brasileirão Série A",
    soccer_portugal_primeira_liga: "Primeira Liga",
  };
  return map[key] ?? key;
}

// =================== TEAM PROFILE (Flashscore-like page) ===================
export const getTeamProfile = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ teamName: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const afKey = process.env.API_FOOTBALL_KEY;
    const empty = {
      team: null as null | { id: number; name: string; logo: string | null; country: string | null; founded: number | null; venue: string | null; venueCity: string | null; venueCapacity: number | null; venueImage: string | null; code: string | null; national: boolean },
      league: null as null | { id: number; name: string; logo: string | null; season: number; country: string | null; flag: string | null },
      next: [] as Array<{ id: number; date: string; status: string; opponent: string; opponentLogo: string | null; venue: "H" | "A"; competition: string; competitionLogo: string | null }>,
      last: [] as Array<{ id: number; date: string; result: "V" | "E" | "D"; gf: number; ga: number; opponent: string; opponentLogo: string | null; venue: "H" | "A"; competition: string; competitionLogo: string | null; status: string }>,
      standings: [] as Array<{ rank: number; team: string; teamLogo: string | null; played: number; win: number; draw: number; lose: number; gf: number; ga: number; gd: number; points: number; form: string }>,
      rank: null as number | null,
      stats: null as null | { played: number; wins: number; draws: number; losses: number; gf: number; ga: number; cleanSheets: number; failedToScore: number; biggestWin: string | null; biggestLose: string | null; avgGoalsScored: string; avgGoalsConceded: string; form: string },
      squad: [] as Array<{ id: number; name: string; age: number | null; number: number | null; position: string; photo: string | null }>,
      topScorers: [] as Array<{ name: string; goals: number; assists: number; appearances: number; photo: string | null }>,
      injuries: [] as Array<{ name: string; reason: string; type: string; photo: string | null }>,
      transfers: [] as Array<{ date: string; type: string; player: string; from: string | null; to: string | null }>,
      trophies: [] as Array<{ league: string; country: string; season: string; place: string }>,
      status: "unavailable" as "ok" | "partial" | "unavailable",
      statusMessage: null as string | null,
    };
    const norm = data.teamName.trim().toLowerCase();
    const sb = getAdminClient();

    // 1) Try cache first (read-side: even when no key, we can serve stale)
    async function readFromCache() {
      const { data: row } = await sb.from("teams_cache").select("*").eq("name_normalized", norm).maybeSingle();
      if (!row) return null;
      const [{ data: nextRows }, { data: lastRows }, { data: standRow }] = await Promise.all([
        sb.from("team_fixtures_cache").select("*").eq("team_id", row.id).eq("kind", "next").order("fixture_date", { ascending: true }),
        sb.from("team_fixtures_cache").select("*").eq("team_id", row.id).eq("kind", "last").order("fixture_date", { ascending: false }),
        row.league_id ? sb.from("standings_cache").select("rows").eq("league_id", row.league_id).eq("season", row.league_season).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const standings = (standRow?.rows as any[]) ?? [];
      return {
        team: { id: row.id, name: row.name, logo: row.logo, country: row.country, founded: row.founded, venue: row.venue_name, venueCity: row.venue_city, venueCapacity: row.venue_capacity, venueImage: row.venue_image, code: row.code, national: !!row.national },
        league: row.league_id ? { id: row.league_id, name: row.league_name, logo: row.league_logo, season: row.league_season, country: row.league_country, flag: row.league_flag } : null,
        next: ((nextRows ?? []) as any[]).map((f: any) => ({ id: f.fixture_id, date: f.fixture_date, status: f.status ?? "NS", opponent: f.opponent_name, opponentLogo: f.opponent_logo, venue: f.venue as "H" | "A", competition: f.competition, competitionLogo: f.competition_logo })),
        last: ((lastRows ?? []) as any[]).map((f: any) => ({ id: f.fixture_id, date: f.fixture_date, result: f.result as "V" | "E" | "D", gf: f.goals_for, ga: f.goals_against, opponent: f.opponent_name, opponentLogo: f.opponent_logo, venue: f.venue as "H" | "A", competition: f.competition, competitionLogo: f.competition_logo, status: f.status ?? "FT" })),
        standings: (standings as any[]),
        rank: row.rank,
        stats: row.stats as any,
        squad: (row.squad ?? []) as Array<{ id: number; name: string; age: number | null; number: number | null; position: string; photo: string | null }>,
        topScorers: (row.top_scorers ?? []) as Array<{ name: string; goals: number; assists: number; appearances: number; photo: string | null }>,
        injuries: (row.injuries ?? []) as Array<{ name: string; reason: string; type: string; photo: string | null }>,
        transfers: (row.transfers ?? []) as Array<{ date: string; type: string; player: string; from: string | null; to: string | null }>,
        trophies: (row.trophies ?? []) as Array<{ league: string; country: string; season: string; place: string }>,
        status: "ok" as const,
        statusMessage: null as string | null,
        _cachedAt: row.updated_at as string,
      };
    }

    const cached = await readFromCache();
    const FRESH_MS = 6 * 3600_000; // 6h
    if (cached) {
      const age = Date.now() - new Date(cached._cachedAt).getTime();
      if (age < FRESH_MS || !afKey) {
        const { _cachedAt, ...rest } = cached;
        return rest;
      }
    }
    if (!afKey) return { ...empty, statusMessage: "API de estatísticas não configurada — sem dados em cache para este time." };

    try {
      const { id: teamId, logo: teamLogo } = await findTeamId(data.teamName, afKey);
      if (!teamId) return { ...empty, statusMessage: `Time "${data.teamName}" não encontrado.` };

      // 1) team info + venue
      const teamInfoRes = await cachedFetch(
        `${AF_BASE}/teams?id=${teamId}`,
        { headers: { "x-apisports-key": afKey } },
        24 * 3600_000,
      ).catch(() => null);
      const ti = teamInfoRes?.response?.[0];
      const team = ti ? {
        id: ti.team.id,
        name: ti.team.name,
        logo: ti.team.logo ?? teamLogo,
        country: ti.team.country ?? null,
        founded: ti.team.founded ?? null,
        venue: ti.venue?.name ?? null,
        venueCity: ti.venue?.city ?? null,
        venueCapacity: ti.venue?.capacity ?? null,
        venueImage: ti.venue?.image ?? null,
        code: ti.team.code ?? null,
        national: !!ti.team.national,
      } : { id: teamId, name: data.teamName, logo: teamLogo, country: null, founded: null, venue: null, venueCity: null, venueCapacity: null, venueImage: null, code: null, national: false };

      const season = new Date().getFullYear();

      // 2) Identify the team's main domestic league for current season
      const leaguesRes = await cachedFetch(
        `${AF_BASE}/leagues?team=${teamId}&season=${season}`,
        { headers: { "x-apisports-key": afKey } },
        6 * 3600_000,
      ).catch(() => null);
      const leagues = (leaguesRes?.response as any[]) ?? [];
      // Prefer League type, country matches team
      const mainLg = leagues.find((l) => l.league?.type === "League" && (!team.country || l.country?.name === team.country))
        ?? leagues.find((l) => l.league?.type === "League")
        ?? leagues[0];
      const league = mainLg ? {
        id: mainLg.league.id as number,
        name: mainLg.league.name as string,
        logo: mainLg.league.logo ?? null,
        season: mainLg.seasons?.[0]?.year ?? season,
        country: mainLg.country?.name ?? null,
        flag: mainLg.country?.flag ?? null,
      } : null;

      // 3) Parallel fetch all profile data
      const [nextRes, lastRes, standRes, statsRes, squadRes, playersRes, injRes, trfRes, troRes] = await Promise.all([
        cachedFetch(`${AF_BASE}/fixtures?team=${teamId}&next=10`, { headers: { "x-apisports-key": afKey } }, 10 * 60_000).catch(() => null),
        cachedFetch(`${AF_BASE}/fixtures?team=${teamId}&last=15`, { headers: { "x-apisports-key": afKey } }, 5 * 60_000).catch(() => null),
        league ? cachedFetch(`${AF_BASE}/standings?league=${league.id}&season=${league.season}`, { headers: { "x-apisports-key": afKey } }, 30 * 60_000).catch(() => null) : Promise.resolve(null),
        league ? cachedFetch(`${AF_BASE}/teams/statistics?team=${teamId}&league=${league.id}&season=${league.season}`, { headers: { "x-apisports-key": afKey } }, 30 * 60_000).catch(() => null) : Promise.resolve(null),
        cachedFetch(`${AF_BASE}/players/squads?team=${teamId}`, { headers: { "x-apisports-key": afKey } }, 12 * 3600_000).catch(() => null),
        league ? cachedFetch(`${AF_BASE}/players?team=${teamId}&season=${league.season}`, { headers: { "x-apisports-key": afKey } }, 60 * 60_000).catch(() => null) : Promise.resolve(null),
        cachedFetch(`${AF_BASE}/injuries?team=${teamId}&season=${season}`, { headers: { "x-apisports-key": afKey } }, 30 * 60_000).catch(() => null),
        cachedFetch(`${AF_BASE}/transfers?team=${teamId}`, { headers: { "x-apisports-key": afKey } }, 24 * 3600_000).catch(() => null),
        cachedFetch(`${AF_BASE}/trophies?team=${teamId}`, { headers: { "x-apisports-key": afKey } }, 24 * 3600_000).catch(() => null),
      ]);

      const next = ((nextRes?.response as any[]) ?? []).map((f) => {
        const isHome = f.teams.home.id === teamId;
        return {
          id: f.fixture.id,
          date: f.fixture.date,
          status: f.fixture?.status?.short ?? "NS",
          opponent: isHome ? f.teams.away.name : f.teams.home.name,
          opponentLogo: isHome ? f.teams.away.logo : f.teams.home.logo,
          venue: (isHome ? "H" : "A") as "H" | "A",
          competition: f.league?.name ?? "—",
          competitionLogo: f.league?.logo ?? null,
        };
      });

      const last = ((lastRes?.response as any[]) ?? []).map((f) => {
        const isHome = f.teams.home.id === teamId;
        const gf = (isHome ? f.goals.home : f.goals.away) ?? 0;
        const ga = (isHome ? f.goals.away : f.goals.home) ?? 0;
        return {
          id: f.fixture.id,
          date: f.fixture.date,
          result: (gf > ga ? "V" : gf < ga ? "D" : "E") as "V" | "E" | "D",
          gf, ga,
          opponent: isHome ? f.teams.away.name : f.teams.home.name,
          opponentLogo: isHome ? f.teams.away.logo : f.teams.home.logo,
          venue: (isHome ? "H" : "A") as "H" | "A",
          competition: f.league?.name ?? "—",
          competitionLogo: f.league?.logo ?? null,
          status: f.fixture?.status?.short ?? "FT",
        };
      });

      const tableRows = standRes?.response?.[0]?.league?.standings?.[0] ?? [];
      const standings = tableRows.map((row: any) => ({
        rank: row.rank,
        team: row.team.name,
        teamLogo: row.team.logo ?? null,
        played: row.all.played,
        win: row.all.win,
        draw: row.all.draw,
        lose: row.all.lose,
        gf: row.all.goals?.for ?? 0,
        ga: row.all.goals?.against ?? 0,
        gd: row.goalsDiff,
        points: row.points,
        form: row.form ?? "",
      }));
      const rank = standings.find((s: any) => s.team === team.name)?.rank
        ?? standings.find((s: any) => s.team.toLowerCase().includes(team.name.toLowerCase().split(" ")[0]))?.rank
        ?? null;

      const s = statsRes?.response;
      const stats = s ? {
        played: s.fixtures?.played?.total ?? 0,
        wins: s.fixtures?.wins?.total ?? 0,
        draws: s.fixtures?.draws?.total ?? 0,
        losses: s.fixtures?.loses?.total ?? 0,
        gf: s.goals?.for?.total?.total ?? 0,
        ga: s.goals?.against?.total?.total ?? 0,
        cleanSheets: s.clean_sheet?.total ?? 0,
        failedToScore: s.failed_to_score?.total ?? 0,
        biggestWin: (s.biggest?.wins?.home || s.biggest?.wins?.away) ? `${s.biggest?.wins?.home ?? "—"} (casa) / ${s.biggest?.wins?.away ?? "—"} (fora)` : null,
        biggestLose: (s.biggest?.loses?.home || s.biggest?.loses?.away) ? `${s.biggest?.loses?.home ?? "—"} (casa) / ${s.biggest?.loses?.away ?? "—"} (fora)` : null,
        avgGoalsScored: String(s.goals?.for?.average?.total ?? "0"),
        avgGoalsConceded: String(s.goals?.against?.average?.total ?? "0"),
        form: s.form ?? "",
      } : null;

      const squadList = (squadRes?.response?.[0]?.players as any[]) ?? [];
      const squad = squadList.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age ?? null,
        number: p.number ?? null,
        position: p.position ?? "—",
        photo: p.photo ?? null,
      }));

      const playersList = (playersRes?.response as any[]) ?? [];
      const topScorers = playersList
        .map((p) => ({
          name: p.player?.name as string,
          photo: p.player?.photo ?? null,
          goals: p.statistics?.[0]?.goals?.total ?? 0,
          assists: p.statistics?.[0]?.goals?.assists ?? 0,
          appearances: p.statistics?.[0]?.games?.appearences ?? 0,
        }))
        .filter((p) => p.name && (p.goals > 0 || p.assists > 0))
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
        .slice(0, 10);

      const injuries = ((injRes?.response as any[]) ?? []).slice(0, 12).map((i) => ({
        name: i.player?.name ?? "—",
        reason: i.player?.reason ?? "indisponível",
        type: i.player?.type ?? "—",
        photo: i.player?.photo ?? null,
      }));

      const transfers: typeof empty.transfers = [];
      for (const tr of ((trfRes?.response as any[]) ?? []).slice(0, 30)) {
        const item = tr.transfers?.[0];
        if (!item) continue;
        transfers.push({
          date: item.date,
          type: item.type ?? "—",
          player: tr.player?.name ?? "—",
          from: item.teams?.out?.name ?? null,
          to: item.teams?.in?.name ?? null,
        });
      }

      const trophies = ((troRes?.response as any[]) ?? []).slice(0, 50).map((t) => ({
        league: t.league ?? "—",
        country: t.country ?? "—",
        season: t.season ?? "—",
        place: t.place ?? "—",
      }));

      const haveAnything = !!team || next.length > 0 || last.length > 0 || standings.length > 0 || squad.length > 0;
      const status: "ok" | "partial" | "unavailable" = haveAnything
        ? (last.length > 0 && standings.length > 0 && squad.length > 0 ? "ok" : "partial")
        : "unavailable";

      // ====== WRITE-THROUGH CACHE ======
      if (team?.id && team.name) {
        try {
          await sb.from("teams_cache").upsert({
            id: team.id, name: team.name, name_normalized: team.name.toLowerCase(),
            logo: team.logo, country: team.country, founded: team.founded, code: team.code, national: team.national,
            venue_name: team.venue, venue_city: team.venueCity, venue_capacity: team.venueCapacity, venue_image: team.venueImage,
            league_id: league?.id ?? null, league_name: league?.name ?? null, league_logo: league?.logo ?? null,
            league_country: league?.country ?? null, league_flag: league?.flag ?? null, league_season: league?.season ?? null,
            rank, stats, squad, top_scorers: topScorers, injuries, transfers, trophies,
            updated_at: new Date().toISOString(),
          }, { onConflict: "id" });

          // Replace fixtures: delete + insert
          await sb.from("team_fixtures_cache").delete().eq("team_id", team.id);
          const fxRows = [
            ...next.map((f) => ({ fixture_id: f.id, team_id: team.id, kind: "next", fixture_date: f.date, status: f.status, opponent_name: f.opponent, opponent_logo: f.opponentLogo, venue: f.venue, competition: f.competition, competition_logo: f.competitionLogo, result: null, goals_for: null, goals_against: null })),
            ...last.map((f) => ({ fixture_id: f.id, team_id: team.id, kind: "last", fixture_date: f.date, status: f.status, opponent_name: f.opponent, opponent_logo: f.opponentLogo, venue: f.venue, competition: f.competition, competition_logo: f.competitionLogo, result: f.result, goals_for: f.gf, goals_against: f.ga })),
          ];
          if (fxRows.length > 0) await sb.from("team_fixtures_cache").insert(fxRows);

          // Standings
          if (league?.id && standings.length > 0) {
            await sb.from("standings_cache").upsert({ league_id: league.id, season: league.season, rows: standings, updated_at: new Date().toISOString() }, { onConflict: "league_id,season" });
          }
        } catch (cacheErr) { console.warn("[team cache write] failed:", (cacheErr as Error).message); }
      }

      return {
        team, league, next, last, standings, rank, stats, squad, topScorers, injuries, transfers, trophies,
        status,
        statusMessage: status === "partial" ? "Alguns dados indisponíveis no momento (cota parcial da API)." : null,
      };
    } catch (e) {
      const msg = (e as Error).message;
      console.warn("[team profile] failed:", msg);
      // Fallback: stale cache better than nothing
      if (cached) {
        const { _cachedAt, ...rest } = cached;
        return { ...rest, statusMessage: `Mostrando dados em cache (API indisponível: ${/429|quota|rate/i.test(msg) ? "cota atingida" : "erro"}).` };
      }
      return { ...empty, statusMessage: /429|quota|rate/i.test(msg) ? "Cota da API atingida." : `Erro: ${msg}` };
    }
  });
