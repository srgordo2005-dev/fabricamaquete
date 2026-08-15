import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "crypto";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

interface RawArticle {
  title: string;
  summary?: string;
  body?: string;
  link: string;
  source: string;
  thumb?: string;
  pubDate: string;
}

const normalizeTitle = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const hashTitle = (t: string) => createHash("sha256").update(normalizeTitle(t)).digest("hex");

async function fetchNewsAPI(): Promise<RawArticle[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  try {
    const r = await fetch(`https://newsapi.org/v2/top-headlines?category=sports&language=pt&pageSize=30&apiKey=${key}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.articles ?? []).map((a: any): RawArticle => ({
      title: a.title ?? "",
      summary: a.description ?? "",
      body: a.content ?? a.description ?? "",
      link: a.url ?? "",
      source: a.source?.name ?? "NewsAPI",
      thumb: a.urlToImage ?? undefined,
      pubDate: a.publishedAt ?? new Date().toISOString(),
    })).filter((a: RawArticle) => a.title);
  } catch { return []; }
}

async function fetchGNews(): Promise<RawArticle[]> {
  const key = process.env.GNEWS_KEY;
  if (!key) return [];
  try {
    const r = await fetch(`https://gnews.io/api/v4/top-headlines?category=sports&lang=pt&country=br&max=20&apikey=${key}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.articles ?? []).map((a: any): RawArticle => ({
      title: a.title ?? "",
      summary: a.description ?? "",
      body: a.content ?? a.description ?? "",
      link: a.url ?? "",
      source: a.source?.name ?? "GNews",
      thumb: a.image ?? undefined,
      pubDate: a.publishedAt ?? new Date().toISOString(),
    })).filter((a: RawArticle) => a.title);
  } catch { return []; }
}

async function fetchGuardian(): Promise<RawArticle[]> {
  const key = process.env.GUARDIAN_KEY;
  if (!key) return [];
  try {
    const r = await fetch(`https://content.guardianapis.com/search?section=football&show-fields=trailText,thumbnail,bodyText&page-size=20&api-key=${key}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.response?.results ?? []).map((a: any): RawArticle => ({
      title: a.webTitle ?? "",
      summary: a.fields?.trailText ?? "",
      body: a.fields?.bodyText?.slice(0, 4000) ?? a.fields?.trailText ?? "",
      link: a.webUrl ?? "",
      source: "The Guardian",
      thumb: a.fields?.thumbnail ?? undefined,
      pubDate: a.webPublicationDate ?? new Date().toISOString(),
    })).filter((a: RawArticle) => a.title);
  } catch { return []; }
}

async function fetchGoogleNewsRSS(): Promise<RawArticle[]> {
  try {
    const r = await fetch("https://news.google.com/rss/search?q=esportes+futebol&hl=pt-BR&gl=BR&ceid=BR:pt-419");
    if (!r.ok) return [];
    const xml = await r.text();
    const items: RawArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xml)) && items.length < 25) {
      const block = m[1];
      const get = (tag: string) => {
        const re = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`);
        const mm = block.match(re);
        return mm ? mm[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
      };
      const title = get("title");
      if (!title) continue;
      const desc = get("description").replace(/<[^>]+>/g, "").trim();
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      items.push({
        title,
        summary: desc.slice(0, 280),
        body: desc,
        link: get("link"),
        source: sourceMatch ? sourceMatch[1] : "Google News",
        pubDate: get("pubDate") || new Date().toISOString(),
      });
    }
    return items;
  } catch { return []; }
}

async function classifyWithAI(title: string, summary: string): Promise<{ category: string; team_ids: string[] }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { category: "todas", team_ids: [] };
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Classify sports news. Return JSON only." },
          { role: "user", content: `Title: ${title}\nSummary: ${summary}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify",
            parameters: {
              type: "object",
              properties: {
                category: { type: "string", enum: ["futebol","apostas","nacional","internacional","copa","selecao","tenis","mercado","f1","libertadores","nba","ufc","volei","todas"] },
                team_ids: { type: "array", items: { type: "string" }, description: "Team names mentioned (e.g. Flamengo, Santos)" },
              },
              required: ["category", "team_ids"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify" } },
      }),
    });
    if (!r.ok) return { category: "todas", team_ids: [] };
    const j = await r.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { category: "todas", team_ids: [] };
    const parsed = JSON.parse(args);
    return { category: parsed.category || "todas", team_ids: (parsed.team_ids || []).slice(0, 5) };
  } catch { return { category: "todas", team_ids: [] }; }
}

export const ingestNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const all = (await Promise.all([fetchNewsAPI(), fetchGNews(), fetchGuardian(), fetchGoogleNewsRSS()])).flat();

    // Dedupe in-batch by hash
    const seen = new Map<string, RawArticle>();
    for (const a of all) {
      const h = hashTitle(a.title);
      if (!seen.has(h)) seen.set(h, a);
    }

    // Filter against existing hashes in DB
    const hashes = Array.from(seen.keys());
    const { data: existing } = await supabaseAdmin
      .from("admin_news")
      .select("content_hash")
      .in("content_hash", hashes);
    const existSet = new Set((existing ?? []).map((r) => r.content_hash));

    let inserted = 0;
    let skipped = 0;
    for (const [h, a] of seen) {
      if (existSet.has(h)) { skipped++; continue; }
      const { category, team_ids } = await classifyWithAI(a.title, a.summary || "");
      const { error } = await supabaseAdmin.from("admin_news").insert({
        title: a.title.slice(0, 500),
        summary: (a.summary || "").slice(0, 600) || null,
        body: a.body || a.summary || a.title,
        thumb: a.thumb || null,
        source: a.source,
        link: a.link,
        category,
        team_ids,
        content_hash: h,
        ai_processed: true,
        status: "pending",
        published: true,
        pub_date: a.pubDate,
        created_by: context.userId,
      });
      if (!error) inserted++;
    }

    return { fetched: all.length, unique: seen.size, inserted, skipped };
  });

export const moderateNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: "approve" | "reject" }) => {
    if (!input?.id) throw new Error("id required");
    if (!["approve", "reject"].includes(input.action)) throw new Error("invalid action");
    return input;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const status = data.action === "approve" ? "approved" : "rejected";
    const { error } = await supabaseAdmin.from("admin_news").update({ status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
