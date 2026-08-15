import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { NewsFeed } from "@/components/NewsFeed";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AdSlot } from "@/components/AdSlot";

export const Route = createFileRoute("/noticias")({
  component: NoticiasPage,
  head: () => ({
    meta: [
      { title: "Notícias do futebol — MinhaAPOSTA" },
      { name: "description", content: "Últimas notícias do futebol brasileiro e mundial, com fotos, resumos e reações." },
      { property: "og:title", content: "Notícias — MinhaAPOSTA" },
      { property: "og:description", content: "Cobertura ao vivo das últimas notícias do futebol." },
    ],
  }),
});

const TABS = [
  { key: "todas", label: "TODAS", q: "todas" },
  { key: "futebol", label: "FUTEBOL", q: "futebol" },
  { key: "apostas", label: "APOSTAS", q: "apostas" },
  { key: "nacional", label: "FUTEBOL NACIONAL", q: "nacional" },
  { key: "internacional", label: "FUTEBOL INTERNACIONAL", q: "internacional" },
  { key: "copa", label: "COPA DO MUNDO", q: "copa" },
  { key: "selecao", label: "SELEÇÃO", q: "selecao" },
  { key: "tenis", label: "TÊNIS", q: "tenis" },
  { key: "mercado", label: "MERCADO DA BOLA", q: "mercado" },
  { key: "f1", label: "F1", q: "f1" },
];

const MORE_TABS = [
  { key: "libertadores", label: "LIBERTADORES", q: "libertadores" },
  { key: "nba", label: "NBA", q: "nba" },
  { key: "ufc", label: "UFC", q: "ufc" },
  { key: "volei", label: "VÔLEI", q: "volei" },
];

function NoticiasPage() {
  const { team } = useFavoriteTeam();
  const [tab, setTab] = useState(TABS[0]);
  const [search, setSearch] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const teamTab = team ? { key: "team", label: `⭐ ${team.shortName.toUpperCase()}`, q: team.name } : null;
  const allTabs = teamTab ? [teamTab, ...TABS] : TABS;

  const activeQuery = search.trim() || tab.q;
  const activeLabel = search.trim() ? `Resultados para “${search.trim()}”` : "Destaques";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 w-full">
        {/* TABS BAR */}
        <div className="border-b border-border bg-card/40 sticky top-0 z-20 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar relative">
              {allTabs.map((t) => {
                const active = !search && tab.key === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setTab(t); setSearch(""); setMoreOpen(false); }}
                    className={`relative shrink-0 px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold tracking-wider transition-colors ${
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                    {active && <span className="absolute left-2 right-2 -top-px h-[3px] bg-primary rounded-b" />}
                  </button>
                );
              })}
              {/* MAIS dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className="flex items-center gap-1 px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold tracking-wider text-muted-foreground hover:text-foreground"
                >
                  MAIS <ChevronDown className="w-3 h-3" />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1 min-w-[180px] rounded-md border border-border bg-popover shadow-xl z-30 py-1">
                    {MORE_TABS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => { setTab(t); setSearch(""); setMoreOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-auto pl-2 py-2 hidden md:block">
                <div className="relative w-56">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar notícia…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE search */}
        <div className="md:hidden max-w-7xl mx-auto px-4 pt-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar notícia…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* CONTENT with side ads on wide screens */}
        <div className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-1 xl:grid-cols-[160px_1fr_160px] gap-6">
          {/* LEFT AD RAIL */}
          <aside className="hidden xl:block">
            <div className="sticky top-20 space-y-4">
              <AdSlot slot="AD_TOP_01" />
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <div className="min-w-0">
            <h2 className="text-xl font-bold mb-4 relative pl-3 before:content-[''] before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:bg-primary before:rounded">
              {activeLabel}
            </h2>
            <NewsFeed query={activeQuery} title={activeLabel} max={24} variant="magazine" />
          </div>

          {/* RIGHT AD RAIL */}
          <aside className="hidden xl:block">
            <div className="sticky top-20 space-y-4">
              <AdSlot slot="AD_BOT_03" />
            </div>
          </aside>
        </div>
      </main>
      <ResponsibleFooter />
    </div>
  );
}
