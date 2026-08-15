import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { listFootballMatches, getMatchOdds, getMatchContext, type MatchSummary } from "@/lib/server-fns/odds.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TeamJersey } from "@/components/TeamJersey";
import { TeamLogo } from "@/components/TeamLogo";
import { cn } from "@/lib/utils";
import { RefreshCw, Sparkles, Zap, Scale, Trophy, Target, X, Calculator, Search, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { DutchModal } from "@/components/DutchModal";

import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { TeamHeroBanner } from "@/components/TeamHeroBanner";
import { FavoriteStar } from "@/components/FavoriteStar";
import { AdSlot } from "@/components/AdSlot";


const CERC_KEY = "madureira_cercamento_selection";
interface CercSelection { matchId: string; sportKey: string; label: string }
function loadCerc(): CercSelection[] { try { return JSON.parse(localStorage.getItem(CERC_KEY) || "[]"); } catch { return []; } }
function saveCerc(s: CercSelection[]) { localStorage.setItem(CERC_KEY, JSON.stringify(s)); }

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

type DateFilter = "all" | "live" | "today" | "tomorrow" | "week";
type OppFilter = "all" | "upcoming" | "arb" | "value" | "balanced" | "favorite";

const AUTO_REFRESH_MS = 90_000; // 1.5 min

function Dashboard() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || i18n.language || "pt").startsWith("en")
    ? "en-US" : (i18n.resolvedLanguage || i18n.language || "pt").startsWith("es")
    ? "es-ES" : "pt-BR";
  const { team: favTeam } = useFavoriteTeam();

  const [data, setData] = useState<{ matches: MatchSummary[]; error: string | null } | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState<string>(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [oppFilter, setOppFilter] = useState<OppFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [cerc, setCerc] = useState<CercSelection[]>([]);
  const [page, setPage] = useState(1);
  const [leagueQuery, setLeagueQuery] = useState("");
  const [dutchModal, setDutchModal] = useState<{ matchId: string; sportKey: string; home: string; away: string; league: string; commenceTime: string } | null>(null);
  const PAGE_SIZE = 200;
  const navigate = useNavigate();

  // Ligas brasileiras (prioridade MÁXIMA — sempre no topo)
  const BR_LEAGUES = ["Brasileir", "Copa do Brasil", "Carioca", "Paulista", "Gaúcho", "Gaucho", "Mineiro", "Brazil"];
  // Ligas principais (priorizadas após as brasileiras). Match por substring case-insensitive.
  const TOP_LEAGUES = [
    "Premier League", "Champions League", "La Liga", "Serie A", "Bundesliga",
    "Ligue 1", "Primeira Liga", "Libertadores", "Europa League",
    "Copa America", "World Cup",
  ];
  const isBrLeague = (name: string) => BR_LEAGUES.some((k) => name.toLowerCase().includes(k.toLowerCase()));
  const isTopLeague = (name: string) => isBrLeague(name) || TOP_LEAGUES.some((k) => name.toLowerCase().includes(k.toLowerCase()));

  useEffect(() => { setCerc(loadCerc()); }, []);

  const toggleCerc = (m: MatchSummary) => {
    const exists = cerc.some((c) => c.matchId === m.id);
    let next: CercSelection[];
    if (exists) next = cerc.filter((c) => c.matchId !== m.id);
    else if (cerc.length >= 4) { return; }
    else next = [...cerc, { matchId: m.id, sportKey: m.sport_key, label: `${m.home} vs ${m.away}` }];
    setCerc(next);
    saveCerc(next);
  };

  const inCerc = (id: string) => cerc.some((c) => c.matchId === id);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await listFootballMatches();
      setData(res);
      setLastUpdate(new Date());
    } catch (e) {
      setData({ matches: [], error: (e as Error).message });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const matches = data?.matches ?? [];

  // ============ FILTERS ============
  const dateFiltered = useMemo(() => {
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
    const endTomorrow = new Date(endToday); endTomorrow.setDate(endTomorrow.getDate() + 1);
    const endWeek = new Date(endToday); endWeek.setDate(endWeek.getDate() + 7);
    return matches.filter((m) => {
      const t = new Date(m.commence_time).getTime();
      if (customDate) {
        const [y, mo, d] = customDate.split("-").map(Number);
        const s = new Date(y, (mo || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
        const e = new Date(y, (mo || 1) - 1, d || 1, 23, 59, 59, 999).getTime();
        if (t < s || t > e) return false;
      }
      switch (dateFilter) {
        case "live": return t <= now && t > now - 3 * 60 * 60 * 1000;
        case "today": return t >= startToday.getTime() && t <= endToday.getTime();
        case "tomorrow": return t > endToday.getTime() && t <= endTomorrow.getTime();
        case "week": return t >= startToday.getTime() && t <= endWeek.getTime();
        default: return true;
      }
    });
  }, [matches, dateFilter, customDate]);

  const oppFiltered = useMemo(() => {
    const now = Date.now();
    return dateFiltered.filter((m) => {
      switch (oppFilter) {
        case "upcoming": return new Date(m.commence_time).getTime() > now;
        case "arb": return m.isArb;
        case "value": return m.marketMargin > 0 && m.marketMargin < 4;
        case "balanced": return m.matchType === "balanced";
        case "favorite": return m.matchType === "heavy_favorite";
        default: return true;
      }
    });
  }, [dateFiltered, oppFilter]);

  const leagues = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of oppFiltered) map.set(m.league, (map.get(m.league) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => {
      // 1) Brasileiras primeiro, 2) Top, 3) resto — alfabético dentro de cada grupo
      const aBr = isBrLeague(a[0]) ? 0 : isTopLeague(a[0]) ? 1 : 2;
      const bBr = isBrLeague(b[0]) ? 0 : isTopLeague(b[0]) ? 1 : 2;
      if (aBr !== bBr) return aBr - bBr;
      return a[0].localeCompare(b[0]);
    });
  }, [oppFiltered]);

  const visibleAll = selectedLeague === "all" ? oppFiltered : oppFiltered.filter((m) => m.league === selectedLeague);
  const totalPages = Math.max(1, Math.ceil(visibleAll.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = visibleAll.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [selectedLeague, dateFilter, oppFilter]);

  // Top opportunities (sorted by best edge)
  const topOpportunities = useMemo(() => {
    return [...oppFiltered]
      .filter((m) => m.bookmakerCount >= 3)
      .sort((a, b) => a.marketMargin - b.marketMargin)
      .slice(0, 5);
  }, [oppFiltered]);

  // Group by date label (Hoje, Amanhã, Sábado 02/05, etc.)
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const startTomorrow = new Date(endToday); startTomorrow.setSeconds(startTomorrow.getSeconds() + 1);
  const endTomorrow = new Date(startTomorrow); endTomorrow.setHours(23, 59, 59, 999);
  const dateLabel = (iso: string) => {
    const d = new Date(iso);
    if (d >= startToday && d <= endToday) return t("dashboard.today");
    if (d >= startTomorrow && d <= endTomorrow) return t("dashboard.tomorrow");
    if (d < startToday) return t("dashboard.finishedGroup");
    return d.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "2-digit" }).toUpperCase();
  };

  const dateOrder = (iso: string) => new Date(iso).setHours(0, 0, 0, 0);
  const grouped = visible.reduce<Record<string, { order: number; matches: MatchSummary[] }>>((acc, m) => {
    const lbl = dateLabel(m.commence_time);
    if (!acc[lbl]) acc[lbl] = { order: dateOrder(m.commence_time), matches: [] };
    acc[lbl].matches.push(m);
    return acc;
  }, {});
  const groupedSorted = Object.entries(grouped).sort((a, b) => a[1].order - b[1].order);

  const dateChips: { id: DateFilter; label: string }[] = [
    { id: "all", label: t("common.all") },
    { id: "live", label: t("dashboard.filters.liveDot") },
    { id: "today", label: t("common.today") },
    { id: "tomorrow", label: t("common.tomorrow") },
    { id: "week", label: t("dashboard.filters.days7") },
  ];

  const oppChips: { id: OppFilter; label: string; icon: any }[] = [
    { id: "all", label: t("dashboard.filters.all"), icon: Sparkles },
    { id: "upcoming", label: t("dashboard.filters.upcoming"), icon: Sparkles },
    { id: "arb", label: t("dashboard.filters.arb"), icon: Zap },
    { id: "value", label: t("dashboard.filters.value"), icon: Trophy },
    { id: "balanced", label: t("dashboard.filters.balanced"), icon: Scale },
    { id: "favorite", label: t("dashboard.filters.favorite"), icon: Trophy },
  ];


  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        <TeamHeroBanner />
        <AdSlot slot="AD_TOP_01" className="mb-4" />
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {lastUpdate && (
                <>{t("dashboard.updatedAt")} {lastUpdate.toLocaleTimeString(locale)} • </>
              )}
              {t("dashboard.autoRefresh")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => load()} disabled={refreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="ml-2 hidden sm:inline">{t("common.refresh")}</span>
            </Button>
          </div>
        </div>

        {/* FILTROS */}
        <Card className="card-elev p-3 mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-16">{t("dashboard.filters.date")}</span>

            {dateChips.map((c) => (
              <button
                key={c.id}
                onClick={() => setDateFilter(c.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  dateFilter === c.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent",
                )}
              >
                {c.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 bg-muted rounded-full px-1 py-0.5">
              <button
                aria-label="Dia anterior"
                onClick={() => {
                  const base = customDate ? new Date(customDate + "T12:00:00") : new Date();
                  base.setDate(base.getDate() - 1);
                  setCustomDate(base.toISOString().slice(0, 10));
                }}
                className="p-1 rounded-full hover:bg-accent"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-transparent text-xs num outline-none w-[110px] text-center"
              />
              <button
                aria-label="Próximo dia"
                onClick={() => {
                  const base = customDate ? new Date(customDate + "T12:00:00") : new Date();
                  base.setDate(base.getDate() + 1);
                  setCustomDate(base.toISOString().slice(0, 10));
                }}
                className="p-1 rounded-full hover:bg-accent"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {customDate && (
                <button
                  aria-label="Limpar data"
                  onClick={() => setCustomDate("")}
                  className="p-1 rounded-full hover:bg-accent"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-16">{t("dashboard.filters.type")}</span>
            {oppChips.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => setOppFilter(c.id)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1",
                    oppFilter === c.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </Card>

        {data?.error && (() => {
          const isQuota = /OUT_OF_USAGE_CREDITS|Usage quota|401/i.test(data.error);
          return (
            <Card className="card-elev p-6 border-destructive/50 mb-6">
              <p className="text-destructive font-semibold">
                {isQuota ? t("dashboard.quotaError") : t("dashboard.fetchError")}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {isQuota
                  ? "A chave ODDS_API_KEY ficou sem créditos do mês. Renove ou troque a chave em the-odds-api.com e atualize o segredo no painel para voltar a receber jogos."
                  : data.error}
              </p>
            </Card>
          );
        })()}

        {/* TOP OPORTUNIDADES */}
        {topOpportunities.length > 0 && oppFilter === "all" && (
          <Card className="card-elev p-4 mb-4 border-primary/30">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                {t("dashboard.topOpps")}
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {topOpportunities.map((m) => (
                <Link
                  key={m.id}
                  to="/match/$matchId"
                  params={{ matchId: m.id }}
                  search={{ sportKey: m.sport_key }}
                  className="p-2 rounded-md bg-muted/30 hover:bg-accent/40 transition-colors border border-border"
                >
                  <div className="text-[10px] text-muted-foreground truncate">{m.league}</div>
                  <div className="text-xs font-semibold truncate flex items-center gap-1.5"><TeamLogo src={m.homeLogo} name={m.home} size={16} />{m.home}</div>
                  <div className="text-xs font-semibold truncate flex items-center gap-1.5"><TeamLogo src={m.awayLogo} name={m.away} size={16} />{m.away}</div>
                  <div className="flex items-center justify-between mt-1">
                    <Badge
                      variant={m.isArb ? "default" : "secondary"}
                      className={cn(
                        "text-[9px] num",
                        m.isArb ? "bg-success text-success-foreground" : "",
                      )}
                    >
                      {m.isArb ? "ARB " : "Margem "}{m.marketMargin.toFixed(2)}%
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar — leagues */}
          <aside>
            <Card className="card-elev p-2 sticky top-20 flex flex-col max-h-[calc(100vh-6rem)]">
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary shrink-0">
                {t("dashboard.leagues")}
              </div>
              {/* Barra de pesquisa */}
              <div className="px-2 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={leagueQuery}
                    onChange={(e) => setLeagueQuery(e.target.value)}
                    placeholder={t("dashboard.searchLeague")}
                    className="h-8 pl-7 pr-7 text-xs"
                  />
                  {leagueQuery && (
                    <button
                      onClick={() => setLeagueQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Limpar pesquisa"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedLeague("all")}
                className={cn(
                  "shrink-0 w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  selectedLeague === "all" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                <span className="font-medium">{t("dashboard.allLeagues")}</span>
                <Badge variant="secondary" className="num text-[10px]">{oppFiltered.length}</Badge>
              </button>
              <div className="h-px bg-border my-2 shrink-0" />

              {/* Lista rolável apenas das ligas */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-0.5 min-h-0">
                {!data && (
                  <div className="space-y-1 p-1">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
                  </div>
                )}
                {(() => {
                  const q = leagueQuery.trim().toLowerCase();
                  const filtered = leagues.filter(([name]) => !q || name.toLowerCase().includes(q));
                  const br = filtered.filter(([name]) => isBrLeague(name));
                  const top = filtered.filter(([name]) => !isBrLeague(name) && isTopLeague(name));
                  const rest = filtered.filter(([name]) => !isTopLeague(name));
                  const renderItem = ([name, count]: [string, number]) => (
                    <button
                      key={name}
                      onClick={() => setSelectedLeague(name)}
                      className={cn(
                        "w-full flex items-start justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                        selectedLeague === name ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                      )}
                      title={name}
                    >
                      <span className="text-left flex items-start gap-1.5 min-w-0 flex-1">
                        {isBrLeague(name) ? (
                          <span className="shrink-0 text-xs leading-5">🇧🇷</span>
                        ) : isTopLeague(name) ? (
                          <Star className="h-3 w-3 mt-1 text-primary fill-primary shrink-0" />
                        ) : null}
                        <span className="break-words leading-tight">{name}</span>
                      </span>
                      <Badge variant="secondary" className="num text-[10px] shrink-0 mt-0.5">{count}</Badge>
                    </button>
                  );
                  return (
                    <>
                      {br.length > 0 && (
                        <>
                          <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-success font-semibold flex items-center gap-1">
                            🇧🇷 Brasil
                          </div>
                          {br.map(renderItem)}
                          {(top.length > 0 || rest.length > 0) && <div className="h-px bg-border my-2" />}
                        </>
                      )}
                      {top.length > 0 && (
                        <>
                          <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                            <Star className="h-3 w-3 text-primary fill-primary" /> {t("dashboard.main")}
                          </div>
                          {top.map(renderItem)}
                          {rest.length > 0 && <div className="h-px bg-border my-2" />}
                        </>
                      )}
                      {rest.length > 0 && (
                        <>
                          {(br.length > 0 || top.length > 0) && (
                            <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              {t("dashboard.others")}
                            </div>
                          )}
                          {rest.map(renderItem)}
                        </>
                      )}
                      {data && filtered.length === 0 && (
                        <p className="px-3 py-4 text-xs text-muted-foreground">
                          {q ? `${t("common.search")}: "${leagueQuery}"` : t("dashboard.noLeagues")}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </Card>
          </aside>

          {/* Match list */}
          <section>
            {!data && (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            )}

            {data && visibleAll.length === 0 && !data.error && (
              <Card className="card-elev p-10 text-center">
                <p className="text-muted-foreground">{t("dashboard.noMatches")}</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => { setDateFilter("all"); setOppFilter("all"); setSelectedLeague("all"); }}
                >
                  {t("dashboard.clearFilters")}
                </Button>
              </Card>
            )}

            <div className="space-y-6">
              {groupedSorted.map(([label, group]) => {
                // Sub-agrupa por liga dentro de cada data — ordem: 🇧🇷 Brasil → Principais → Outras (alfabética)
                const byLeague = new Map<string, MatchSummary[]>();
                for (const m of group.matches) {
                  if (!byLeague.has(m.league)) byLeague.set(m.league, []);
                  byLeague.get(m.league)!.push(m);
                }
                const leagueGroups = Array.from(byLeague.entries()).sort((a, b) => {
                  const aR = isBrLeague(a[0]) ? 0 : isTopLeague(a[0]) ? 1 : 2;
                  const bR = isBrLeague(b[0]) ? 0 : isTopLeague(b[0]) ? 1 : 2;
                  if (aR !== bR) return aR - bR;
                  return a[0].localeCompare(b[0]);
                });
                return (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-2 px-1 sticky top-16 bg-background/95 backdrop-blur z-10 py-2 -mx-1 rounded">
                    <div className="w-1 h-5 rounded-full grad-neon" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-primary">{label}</h2>
                    <span className="num text-[11px] text-muted-foreground">{group.matches.length} {t("dashboard.games")}</span>
                  </div>
                  <div className="space-y-4">
                  {leagueGroups.map(([leagueName, leagueMatches]) => (
                    <div key={leagueName}>
                      <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded bg-muted/40 border-l-4 border-primary/60">
                        {isBrLeague(leagueName) ? <span>🇧🇷</span> : isTopLeague(leagueName) ? <Star className="h-3 w-3 text-primary fill-primary" /> : null}
                        <span className="text-xs font-bold uppercase tracking-wider truncate">{leagueName}</span>
                        <span className="num text-[10px] text-muted-foreground ml-auto">{leagueMatches.length}</span>
                      </div>
                  <Card className="card-elev overflow-hidden divide-y divide-border">
                    {leagueMatches.map((m) => {
                      const prefetch = () => {
                        getMatchOdds({ data: { matchId: m.id, sportKey: m.sport_key } }).catch(() => {});
                        getMatchContext({ data: { home: m.home, away: m.away } }).catch(() => {});
                      };
                      const selected = inCerc(m.id);
                      const canAdd = cerc.length < 4 || selected;
                      const hasBet365 = m.bet365Home > 0 || m.bet365Away > 0;
                      // Status do jogo (prioriza statusShort da API-Football quando existir)
                      const startMs = new Date(m.commence_time).getTime();
                      const nowMs = Date.now();
                      const st = m.statusShort ?? "";
                      const FINISHED_CODES = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];
                      const LIVE_CODES = ["1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE"];
                      const isFinished = FINISHED_CODES.includes(st) || (st === "" && startMs < nowMs - 2.5 * 60 * 60 * 1000);
                      const isLive = LIVE_CODES.includes(st) || (st === "" && startMs <= nowMs && !isFinished);
                      const hasScore = typeof m.homeGoals === "number" && typeof m.awayGoals === "number";
                      return (
                        <div key={m.id} className={cn(
                          "flex items-center gap-2 px-3 py-3 hover:bg-accent/40 transition-colors",
                          selected && "bg-primary/5 border-l-2 border-primary",
                          isFinished && "opacity-50",
                        )}>
                          <FavoriteStar
                            entityId={m.id}
                            entityType="match"
                            metadata={{ home: m.home, away: m.away, league: m.league, commence_time: m.commence_time, sport_key: m.sport_key }}
                            size={20}
                            className="shrink-0 w-7 h-7"
                          />
                          <Link
                            to="/match/$matchId"
                            params={{ matchId: m.id }}
                            search={{ sportKey: m.sport_key }}
                            onMouseEnter={prefetch}
                            onTouchStart={prefetch}
                            className="flex items-center gap-3 flex-1 min-w-0"
                          >
                            <div className="num text-[11px] text-muted-foreground w-24 text-center leading-tight shrink-0">
                              <div className="font-semibold text-foreground">{new Date(m.commence_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                              <div className="opacity-60 text-[10px]">{new Date(m.commence_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
                              {isLive && (
                                <div className="text-[9px] font-bold text-destructive animate-pulse">
                                  🔴 {m.statusElapsed ? `${m.statusElapsed}'` : (m.statusShort === "HT" ? t("dashboard.interval") : t("dashboard.liveLabel"))}
                                </div>
                              )}
                              {isFinished && <div className="text-[9px] font-bold text-muted-foreground">⛔ {m.statusShort === "FT" ? t("dashboard.final") : (m.statusShort || t("common.finished"))}</div>}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground leading-tight" title={m.league}>
                                {isBrLeague(m.league) && <span>🇧🇷</span>}
                                <span className="truncate">{m.league}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <TeamLogo src={m.homeLogo} name={m.home} size={22} />
                                <span className="text-sm font-medium truncate flex-1">{m.home}</span>
                                {hasScore && (
                                  <span className={cn(
                                    "num text-sm font-bold tabular-nums w-6 text-center",
                                    isLive ? "text-destructive" : "text-foreground",
                                  )}>{m.homeGoals}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <TeamLogo src={m.awayLogo} name={m.away} size={22} />
                                <span className="text-sm font-medium truncate flex-1">{m.away}</span>
                                {hasScore && (
                                  <span className={cn(
                                    "num text-sm font-bold tabular-nums w-6 text-center",
                                    isLive ? "text-destructive" : "text-foreground",
                                  )}>{m.awayGoals}</span>
                                )}
                              </div>
                            </div>

                            {/* Score / Status column */}
                            <div className={cn(
                              "hidden sm:flex flex-col items-center gap-0.5 shrink-0 w-20 px-1 py-1 rounded border",
                              isLive ? "border-destructive/50 bg-destructive/5" :
                              isFinished ? "border-border bg-muted/30" :
                              "border-border/50 bg-muted/20",
                            )}>
                              {isLive ? (
                                <>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-destructive animate-pulse">🔴 AO VIVO</span>
                                  <div className="num text-base font-bold tabular-nums text-destructive">
                                    {hasScore ? `${m.homeGoals} - ${m.awayGoals}` : "—"}
                                  </div>
                                  <span className="text-[9px] text-muted-foreground">
                                    {m.statusElapsed ? `${m.statusElapsed}'` : (m.statusShort === "HT" ? t("dashboard.interval") : "")}
                                  </span>
                                </>
                              ) : isFinished ? (
                                <>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">⛔ ENCERRADO</span>
                                  <div className="num text-base font-bold tabular-nums text-foreground">
                                    {hasScore ? `${m.homeGoals} - ${m.awayGoals}` : "—"}
                                  </div>
                                  <span className="text-[9px] text-muted-foreground">{m.statusShort || "FT"}</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-yellow-500">bet365</span>
                                  {hasBet365 ? (
                                    <div className="flex gap-1.5 num text-[11px]">
                                      <span title="Casa" className="font-semibold">{m.bet365Home > 0 ? m.bet365Home.toFixed(2) : "—"}</span>
                                      <span className="opacity-50">|</span>
                                      <span title="Empate" className="opacity-70">{m.bet365Draw > 0 ? m.bet365Draw.toFixed(2) : "—"}</span>
                                      <span className="opacity-50">|</span>
                                      <span title="Fora" className="font-semibold">{m.bet365Away > 0 ? m.bet365Away.toFixed(2) : "—"}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground">indisp.</span>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Best odds column (highest paying) */}
                            <div className="flex flex-col items-center gap-0.5 shrink-0 w-20 px-1 py-1 rounded border border-success/40 bg-success/5">
                              <span className="text-[8px] font-bold uppercase tracking-wider text-success">Melhor 💰</span>
                              <div className="flex gap-1 num text-[11px]">
                                <span title="Casa" className="font-bold text-success">{m.bestHome > 0 ? m.bestHome.toFixed(2) : "—"}</span>
                                <span className="opacity-40">|</span>
                                <span title="Empate" className="font-bold text-success">{m.bestDraw > 0 ? m.bestDraw.toFixed(2) : "—"}</span>
                                <span className="opacity-40">|</span>
                                <span title="Fora" className="font-bold text-success">{m.bestAway > 0 ? m.bestAway.toFixed(2) : "—"}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0 w-20">
                              {m.isArb ? (
                                <Badge className="bg-success text-success-foreground num text-[10px]">ARB {m.marketMargin.toFixed(1)}%</Badge>
                              ) : m.marketMargin > 0 && m.marketMargin < 4 ? (
                                <Badge className="bg-primary/20 text-primary border border-primary/40 num text-[10px]">+EV {m.marketMargin.toFixed(1)}%</Badge>
                              ) : (
                                <Badge variant="secondary" className="num text-[10px]">{m.bookmakerCount} {t("dashboard.houses")}</Badge>
                              )}
                              <span className="text-[9px] text-muted-foreground text-right">
                                {m.matchType === "balanced" ? t("dashboard.badgeBalanced") : t("dashboard.badgeFavorite")}
                              </span>
                            </div>
                          </Link>

                          {/* Dutching button — bloqueado para jogos encerrados */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (isFinished) {
                                toast.warning(t("dashboard.cercClosed"), { duration: 4000 });
                                return;
                              }
                              if (!selected) {
                                if (!canAdd) { toast.error(t("dashboard.cercLimit")); return; }
                                toggleCerc(m);
                              }
                              toast.success(t("dashboard.cercTitle"));
                            }}
                            title={isFinished ? t("dashboard.cercClosed") : t("dashboard.cercSurround")}
                            className={cn(
                              "shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors",
                              isFinished
                                ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                                : "bg-primary/10 text-primary border-primary/40 hover:bg-primary hover:text-primary-foreground",
                            )}
                          >
                            <Calculator className="h-4 w-4" />
                          </button>
                        </div>);
                    })}
                  </Card>
                    </div>
                  ))}
                  </div>
                </div>
                );
              })}
            </div>

            {/* PAGINAÇÃO — 200 por página */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                  ← {t("common.previous")}
                </Button>
                <span className="text-xs text-muted-foreground num px-2">
                  {t("common.page")} {currentPage} {t("common.of")} {totalPages}
                </span>
                <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                  {t("common.next")} →
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* CERCAMENTO FLOATING BAR */}
      {cerc.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[calc(100%-2rem)]">
          <Card className="card-elev p-3 border-2 border-primary/60 shadow-xl bg-card/95 backdrop-blur">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 shrink-0">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">{t("dashboard.cercTitle")} ({cerc.length}/4)</span>
              </div>
              <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                {cerc.map((c) => (
                  <Badge key={c.matchId} variant="secondary" className="text-[10px] gap-1 max-w-[180px]">
                    <span className="truncate">{c.label}</span>
                    <button onClick={() => { const next = cerc.filter((x) => x.matchId !== c.matchId); setCerc(next); saveCerc(next); }} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setCerc([]); saveCerc([]); }}>{t("common.clear")}</Button>
                <Button size="sm" disabled={cerc.length < 2} onClick={() => navigate({ to: "/cercamento" })} className="grad-neon text-primary-foreground font-semibold">
                  {t("dashboard.cercSurround")} {cerc.length >= 2 ? `${Math.pow(3, cerc.length)} ${t("dashboard.cercCombos")}` : t("dashboard.cercMin")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 pb-6 w-full space-y-4">
        <AdSlot slot="AD_MID_02" />
        <AdSlot slot="AD_BOT_03" />
      </div>

      <ResponsibleFooter />
      <Toaster richColors position="top-center" />
      {dutchModal && (
        <DutchModal
          open={!!dutchModal}
          onOpenChange={(v) => { if (!v) setDutchModal(null); }}
          matchId={dutchModal.matchId}
          sportKey={dutchModal.sportKey}
          home={dutchModal.home}
          away={dutchModal.away}
          league={dutchModal.league}
          commenceTime={dutchModal.commenceTime}
        />
      )}
    </div>
  );
}
