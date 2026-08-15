import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface NewsItem {
  id?: string;
  title: string;
  link: string;
  source: string;
  pubDate: string;
  thumb?: string;
  summary?: string;
  body?: string;
  category?: string;
}

export const getNews = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => {
    const q = String(input?.query ?? "").trim().slice(0, 200);
    return { query: q };
  })
  .handler(async ({ data }) => {
    const q = data.query.toLowerCase();

    let query = supabaseAdmin
      .from("admin_news")
      .select("id, title, summary, body, thumb, source, category, link, pub_date")
      .eq("published", true)
      .eq("status", "approved")
      .order("pub_date", { ascending: false })
      .limit(50);

    // Match by category key when query equals a known tab key (e.g. "futebol", "apostas")
    // Otherwise free-text search across title/summary/body.
    const knownCats = ["todas", "futebol", "apostas", "nacional", "internacional", "copa", "selecao", "tenis", "mercado", "f1", "libertadores", "nba", "ufc", "volei"];
    if (q && q !== "todas" && q !== "futebol" && knownCats.includes(q)) {
      query = query.eq("category", q);
    } else if (q && !knownCats.includes(q)) {
      const safe = q.replace(/[%,]/g, " ");
      query = query.or(`title.ilike.%${safe}%,summary.ilike.%${safe}%,body.ilike.%${safe}%`);
    }

    const { data: rows, error } = await query;
    if (error) return { items: [], cached: false };

    const items: NewsItem[] = (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      link: r.link ?? "",
      source: r.source ?? "",
      pubDate: r.pub_date,
      thumb: r.thumb ?? undefined,
      summary: r.summary ?? undefined,
      body: r.body ?? undefined,
      category: r.category ?? undefined,
    }));
    return { items, cached: false };
  });
