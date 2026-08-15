import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ingestNews, moderateNews } from "@/lib/news-ingest.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Eye, EyeOff, Check, X, RefreshCw, ExternalLink } from "lucide-react";

interface NewsRow {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  thumb: string | null;
  source: string | null;
  category: string;
  link: string | null;
  published: boolean;
  pub_date: string;
  status: "pending" | "approved" | "rejected";
  team_ids: string[] | null;
}

const CATEGORIES = ["todas", "futebol", "apostas", "nacional", "internacional", "copa", "selecao", "tenis", "mercado", "f1", "libertadores", "nba", "ufc", "volei"];

const empty = (userId: string) => ({
  title: "", summary: "", body: "", thumb: "", source: "",
  category: "todas", link: "", published: true, status: "approved" as const, created_by: userId,
});

export function NewsPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [editing, setEditing] = useState<Partial<NewsRow> & { created_by?: string } | null>(null);
  const [preview, setPreview] = useState<NewsRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const ingest = useServerFn(ingestNews);
  const moderate = useServerFn(moderateNews);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin_news").select("*").order("pub_date", { ascending: false }).limit(300);
    if (error) toast.error(error.message); else setRows((data ?? []) as NewsRow[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const runIngest = async () => {
    setIngesting(true);
    try {
      const r = await ingest({ data: undefined as never });
      toast.success(`Buscou ${r.fetched} • novas: ${r.inserted} • duplicadas: ${r.skipped}`);
      load();
    } catch (e: any) { toast.error(e?.message || "Falha na ingestão"); }
    finally { setIngesting(false); }
  };

  const doModerate = async (id: string, action: "approve" | "reject") => {
    try {
      await moderate({ data: { id, action } });
      toast.success(action === "approve" ? "Aprovada" : "Rejeitada");
      setPreview(null); load();
    } catch (e: any) { toast.error(e?.message || "Erro"); }
  };

  const save = async () => {
    if (!editing?.title?.trim() || !editing?.body?.trim()) {
      toast.error("Título e corpo são obrigatórios"); return;
    }
    setBusy(true);
    const payload = {
      title: editing.title!.trim(),
      summary: editing.summary?.trim() || null,
      body: editing.body!.trim(),
      thumb: editing.thumb?.trim() || null,
      source: editing.source?.trim() || null,
      category: editing.category || "todas",
      link: editing.link?.trim() || null,
      published: editing.published ?? true,
      status: "approved" as const,
    };
    const { error } = editing.id
      ? await supabase.from("admin_news").update(payload).eq("id", editing.id)
      : await supabase.from("admin_news").insert({ ...payload, created_by: userId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Atualizada" : "Publicada");
    setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta notícia?")) return;
    const { error } = await supabase.from("admin_news").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removida"); load(); }
  };

  const togglePublish = async (n: NewsRow) => {
    const { error } = await supabase.from("admin_news").update({ published: !n.published }).eq("id", n.id);
    if (error) toast.error(error.message); else load();
  };

  const pending = rows.filter(r => r.status === "pending");
  const approved = rows.filter(r => r.status === "approved");
  const rejected = rows.filter(r => r.status === "rejected");

  const renderRow = (n: NewsRow, showModerate = false) => (
    <div key={n.id} className="py-3 flex items-start gap-3">
      {n.thumb && <img src={n.thumb} alt="" className="w-16 h-16 rounded object-cover shrink-0" />}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setPreview(n)}>
        <div className="font-semibold truncate">{n.title}</div>
        <div className="text-xs text-muted-foreground truncate">
          {n.source || "—"} · {n.category} · {new Date(n.pub_date).toLocaleString("pt-BR")} {!n.published && "· (oculta)"}
        </div>
        {n.team_ids && n.team_ids.length > 0 && (
          <div className="text-xs text-primary mt-1">Times: {n.team_ids.join(", ")}</div>
        )}
      </div>
      {showModerate ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => doModerate(n.id, "approve")} title="Aprovar">
            <Check className="w-4 h-4 text-green-500" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => doModerate(n.id, "reject")} title="Rejeitar">
            <X className="w-4 h-4 text-destructive" />
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => togglePublish(n)}>
            {n.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(n)}>
            <Pencil className="w-4 h-4" />
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" onClick={() => remove(n.id)}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold">Notícias</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={runIngest} disabled={ingesting} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-1 ${ingesting ? "animate-spin" : ""}`} />
              {ingesting ? "Buscando..." : "Buscar das APIs"}
            </Button>
            <Button size="sm" onClick={() => setEditing(empty(userId))} className="grad-neon text-primary-foreground">
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          </div>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved">Aprovadas ({approved.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitadas ({rejected.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <div className="divide-y divide-border">
              {pending.map(n => renderRow(n, true))}
              {pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pendente. Clique em "Buscar das APIs".</p>}
            </div>
          </TabsContent>
          <TabsContent value="approved">
            <div className="divide-y divide-border">
              {approved.map(n => renderRow(n))}
              {approved.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma aprovada.</p>}
            </div>
          </TabsContent>
          <TabsContent value="rejected">
            <div className="divide-y divide-border">
              {rejected.map(n => renderRow(n))}
              {rejected.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma rejeitada.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {preview && (
        <Card className="p-4 space-y-3 border-primary/40">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-lg">{preview.title}</h3>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {preview.source} · {preview.category} · {new Date(preview.pub_date).toLocaleString("pt-BR")}
          </div>
          {preview.thumb && <img src={preview.thumb} alt="" className="w-full max-h-80 object-cover rounded" />}
          {preview.summary && <p className="text-sm font-medium">{preview.summary}</p>}
          <div className="text-sm whitespace-pre-wrap text-muted-foreground max-h-96 overflow-auto">{preview.body}</div>
          {preview.link && (
            <a href={preview.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
              Ver original <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {preview.status === "pending" && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button onClick={() => doModerate(preview.id, "approve")} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-1" /> Aprovar
              </Button>
              <Button onClick={() => doModerate(preview.id, "reject")} variant="destructive">
                <X className="w-4 h-4 mr-1" /> Rejeitar
              </Button>
            </div>
          )}
        </Card>
      )}

      {editing && (
        <Card className="p-4 space-y-3 border-primary/40">
          <h3 className="font-semibold">{editing.id ? "Editar notícia" : "Nova notícia"}</h3>
          <Input placeholder="Título *" value={editing.title ?? ""} onChange={e => setEditing({ ...editing, title: e.target.value })} />
          <Input placeholder="Resumo (1 linha)" value={editing.summary ?? ""} onChange={e => setEditing({ ...editing, summary: e.target.value })} />
          <Textarea placeholder="Corpo da notícia *" rows={10} value={editing.body ?? ""} onChange={e => setEditing({ ...editing, body: e.target.value })} />
          <div className="grid sm:grid-cols-2 gap-2">
            <Input placeholder="URL da imagem (thumb)" value={editing.thumb ?? ""} onChange={e => setEditing({ ...editing, thumb: e.target.value })} />
            <Input placeholder="Fonte (ex: Globo)" value={editing.source ?? ""} onChange={e => setEditing({ ...editing, source: e.target.value })} />
            <Input placeholder="Link externo (opcional)" value={editing.link ?? ""} onChange={e => setEditing({ ...editing, link: e.target.value })} />
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={editing.category ?? "todas"} onChange={e => setEditing({ ...editing, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.published ?? true} onChange={e => setEditing({ ...editing, published: e.target.checked })} />
            Publicada
          </label>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy} className="grad-neon text-primary-foreground">{editing.id ? "Salvar" : "Publicar"}</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
