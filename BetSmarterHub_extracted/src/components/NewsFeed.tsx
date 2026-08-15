import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getNews, type NewsItem } from "@/lib/news.functions";
import { Share2, Smile, ExternalLink, Newspaper, Clock } from "lucide-react";
import { toast } from "sonner";
import { AdSlot } from "@/components/AdSlot";

interface Props {
  query: string;
  title?: string;
  max?: number;
  /** Show the rich magazine layout (hero + grid). Defaults to compact list when false. */
  variant?: "list" | "magazine";
}

const REACTIONS = ["👍", "🔥", "😂", "😮", "😢", "⚽"];

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  if (!d) return "";
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const REACT_KEY = "mb:newsReactions";

function loadReactions(): Record<string, Record<string, number>> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(REACT_KEY) || "{}"); } catch { return {}; }
}

// Deterministic gradient per item so cards without thumb still look unique
function fallbackGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const hue2 = (hue + 60) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 35%) 0%, hsl(${hue2} 75% 25%) 100%)`;
}

export function NewsFeed({ query, title = "📰 Notícias", max = 8, variant = "list" }: Props) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>(() => loadReactions());
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [open, setOpen] = useState<NewsItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    getNews({ data: { query } })
      .then((r) => { if (!cancelled) setItems(r.items.slice(0, max)); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar notícias agora."); });
    return () => { cancelled = true; };
  }, [query, max]);

  const react = (id: string, emoji: string) => {
    setReactions((prev) => {
      const cur = { ...(prev[id] ?? {}) };
      cur[emoji] = (cur[emoji] ?? 0) + 1;
      const next = { ...prev, [id]: cur };
      try { localStorage.setItem(REACT_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    setOpenPicker(null);
  };

  const share = async (n: NewsItem) => {
    const shareData = { title: n.title, text: n.title, url: n.link };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${n.title}\n${n.link}`);
        toast.success("Link copiado!");
      }
    } catch { /* user cancelled */ }
  };

  const idOf = (n: NewsItem, i: number) => n.link || String(i);

  const reactionsBar = (id: string) => {
    const r = reactions[id] ?? {};
    const total = Object.values(r).reduce((a, b) => a + b, 0);
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {Object.entries(r).filter(([, v]) => v > 0).map(([emoji, count]) => (
          <button key={emoji} type="button" onClick={(e) => { e.stopPropagation(); react(id, emoji); }}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors">
            <span>{emoji}</span><span className="num text-[10px]">{count}</span>
          </button>
        ))}
        {total === 0 && <span className="text-[10px] text-muted-foreground">Reaja primeiro</span>}
      </div>
    );
  };

  const actionBar = (n: NewsItem, id: string) => (
    <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => share(n)}
        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border hover:border-primary/50 hover:bg-primary/10 transition-colors">
        <Share2 className="w-3 h-3" /> Compartilhar
      </button>
      <div className="relative">
        <button type="button" onClick={() => setOpenPicker((p) => (p === id ? null : id))}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border hover:border-primary/50 hover:bg-primary/10 transition-colors">
          <Smile className="w-3 h-3" /> Reagir
        </button>
        {openPicker === id && (
          <div className="absolute z-10 mt-1 left-0 flex gap-1 p-1.5 rounded-md border border-border bg-popover shadow-lg">
            {REACTIONS.map((e) => (
              <button key={e} type="button" onClick={() => react(id, e)}
                className="text-lg hover:scale-125 transition-transform px-1">{e}</button>
            ))}
          </div>
        )}
      </div>
      {reactionsBar(id)}
    </div>
  );

  // ============================ MAGAZINE LAYOUT ============================
  const magazine = useMemo(() => {
    if (!items || items.length === 0) return null;
    const [hero, ...rest] = items;
    return { hero, rest };
  }, [items]);

  if (variant === "magazine") {
    return (
      <div className="space-y-6">
        {error && <Card className="p-4"><p className="text-sm text-muted-foreground">{error}</p></Card>}
        {!items && !error && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-0 overflow-hidden animate-pulse">
                <div className="aspect-video bg-muted" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        )}
        {magazine && (
          <>
            {/* HERO */}
            <Card
              className="relative overflow-hidden cursor-pointer group border-primary/30"
              onClick={() => setOpen(magazine.hero)}
            >
              <div
                className="aspect-[16/8] w-full relative"
                style={magazine.hero.thumb ? undefined : { background: fallbackGradient(magazine.hero.title) }}
              >
                {magazine.hero.thumb && (
                  <img src={magazine.hero.thumb} alt={magazine.hero.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 text-white">
                  <Badge className="bg-primary text-primary-foreground mb-2">🔥 Destaque</Badge>
                  <h3 className="text-xl md:text-3xl font-bold leading-tight drop-shadow-lg">{magazine.hero.title}</h3>
                  {magazine.hero.summary && (
                    <p className="text-sm md:text-base text-white/85 mt-2 line-clamp-2 drop-shadow">{magazine.hero.summary}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-white/80">
                    {magazine.hero.source && <span className="font-semibold">{magazine.hero.source}</span>}
                    {magazine.hero.pubDate && (
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(magazine.hero.pubDate)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-3 border-t border-border bg-card">
                {actionBar(magazine.hero, idOf(magazine.hero, 0))}
              </div>
            </Card>

            {/* AD between hero and grid */}
            <AdSlot slot="AD_TOP_01" />

            {/* GRID */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {magazine.rest.map((n, i) => {
                const id = idOf(n, i + 1);
                return (
                  <div key={id} className="contents">
                    <Card
                      className="p-0 overflow-hidden cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 transition-all group"
                      onClick={() => setOpen(n)}
                    >
                      <div
                        className="aspect-video relative overflow-hidden"
                        style={n.thumb ? undefined : { background: fallbackGradient(n.title) }}
                      >
                        {n.thumb ? (
                          <img src={n.thumb} alt={n.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            loading="lazy"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <Newspaper className="absolute inset-0 m-auto w-12 h-12 text-white/30" />
                        )}
                        {n.source && (
                          <Badge className="absolute top-2 left-2 bg-black/70 text-white border-0 text-[10px]">{n.source}</Badge>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <h4 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{n.title}</h4>
                        {n.summary && <p className="text-xs text-muted-foreground line-clamp-2">{n.summary}</p>}
                        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {timeAgo(n.pubDate)}
                        </div>
                        {actionBar(n, id)}
                      </div>
                    </Card>
                    {/* Inject mid-page ad after every 6 cards */}
                    {(i + 1) % 6 === 0 && (
                      <div className="md:col-span-2 lg:col-span-3"><AdSlot slot="AD_MID_02" /></div>
                    )}
                  </div>
                );
              })}
            </div>

            <AdSlot slot="AD_BOT_03" />
          </>
        )}

        {/* MODAL — full article preview */}
        <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
            {open && (
              <>
                <div
                  className="aspect-video w-full relative"
                  style={open.thumb ? undefined : { background: fallbackGradient(open.title) }}
                >
                  {open.thumb && (
                    <img src={open.thumb} alt={open.title} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    {open.source && <Badge className="bg-primary text-primary-foreground mb-2">{open.source}</Badge>}
                    <DialogTitle className="text-xl md:text-2xl font-bold drop-shadow-lg">{open.title}</DialogTitle>
                    <div className="text-xs text-white/80 mt-1 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {timeAgo(open.pubDate)}
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <DialogHeader className="sr-only"><DialogTitle>{open.title}</DialogTitle></DialogHeader>
                  {open.summary && <p className="text-sm leading-relaxed text-foreground/90 font-medium">{open.summary}</p>}
                  {open.body && (
                    <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {open.body}
                    </div>
                  )}
                  <AdSlot slot="AD_MID_02" />
                  <div className="flex items-center gap-2 flex-wrap">
                    {open.link && (
                      <Button asChild variant="outline">
                        <a href={open.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1" /> Fonte original
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => share(open)}>
                      <Share2 className="w-4 h-4 mr-1" /> Compartilhar
                    </Button>
                    {actionBar(open, idOf(open, -1))}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ============================ COMPACT LIST (sidebar) ============================
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-[10px] font-normal text-muted-foreground normal-case">{query}</span>
      </h2>
      {error && <p className="text-xs text-muted-foreground">{error}</p>}
      {!items && !error && <p className="text-xs text-muted-foreground">Carregando…</p>}
      {items && items.length === 0 && <p className="text-xs text-muted-foreground">Sem notícias recentes.</p>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-border/60">
          {items.map((n, i) => {
            const id = idOf(n, i);
            return (
              <li key={id} className="py-3">
                <button type="button" onClick={() => setOpen(n)} className="text-left block group w-full">
                  <div className="flex gap-3">
                    {n.thumb && (
                      <img src={n.thumb} alt="" className="w-16 h-16 rounded object-cover shrink-0" loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex gap-2">
                        {n.source && <span className="truncate">{n.source}</span>}
                        {n.pubDate && <span>• {timeAgo(n.pubDate)}</span>}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="mt-2">{actionBar(n, id)}</div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          {open && (
            <>
              <div className="aspect-video w-full relative" style={open.thumb ? undefined : { background: fallbackGradient(open.title) }}>
                {open.thumb && <img src={open.thumb} alt={open.title} className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-0 p-4 text-white">
                  <DialogTitle className="text-lg font-bold drop-shadow">{open.title}</DialogTitle>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <DialogHeader className="sr-only"><DialogTitle>{open.title}</DialogTitle></DialogHeader>
                {open.summary && <p className="text-sm font-medium">{open.summary}</p>}
                {open.body && <div className="text-sm whitespace-pre-wrap">{open.body}</div>}
                {open.link && (
                  <Button asChild size="sm" variant="outline">
                    <a href={open.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Fonte original
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
