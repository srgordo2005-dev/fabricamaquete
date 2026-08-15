import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Upload, Plus } from "lucide-react";

interface Ad {
  id: string;
  slot: string;
  title: string;
  image_url: string;
  link_url: string | null;
  duration_sec: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  team_id: string | null;
  created_at: string;
}

const SLOTS = [
  { id: "AD_TOP_01", label: "Topo (sob navbar)" },
  { id: "AD_MID_02", label: "Meio (entre conteúdo)" },
  { id: "AD_BOT_03", label: "Rodapé" },
] as const;

export function AdsPanel() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    slot: "AD_TOP_01",
    title: "",
    link_url: "",
    duration_sec: 15,
    starts_at: "",
    ends_at: "",
    team_id: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("ads").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setAds((data as Ad[]) || []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Selecione uma imagem");
    if (!form.title.trim()) return toast.error("Adicione um título");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${form.slot}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("ads").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("ads").getPublicUrl(path);
      const { error } = await supabase.from("ads").insert({
        slot: form.slot,
        title: form.title.trim(),
        image_url: pub.publicUrl,
        link_url: form.link_url.trim() || null,
        duration_sec: Math.max(3, Math.min(120, form.duration_sec)),
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        team_id: form.team_id.trim() || null,
        active: true,
      });
      if (error) throw error;
      toast.success("Anúncio criado");
      setForm({ slot: "AD_TOP_01", title: "", link_url: "", duration_sec: 15, starts_at: "", ends_at: "", team_id: "" });
      setFile(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (ad: Ad) => {
    const { error } = await supabase.from("ads").update({ active: !ad.active }).eq("id", ad.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (ad: Ad) => {
    if (!confirm(`Remover "${ad.title}"?`)) return;
    const { error } = await supabase.from("ads").delete().eq("id", ad.id);
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  };

  return (
    <>
      <Card className="card-elev p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Novo anúncio</h2>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Slot</label>
            <select
              value={form.slot}
              onChange={e => setForm(f => ({ ...f, slot: e.target.value }))}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              {SLOTS.map(s => <option key={s.id} value={s.id}>{s.id} — {s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Título</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={100} required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Link (opcional)</label>
            <Input type="url" value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duração na rotação (s)</label>
            <Input type="number" min={3} max={120} value={form.duration_sec}
              onChange={e => setForm(f => ({ ...f, duration_sec: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Time alvo (id, opcional)</label>
            <Input value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} placeholder="ex: flamengo" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Início (opcional)</label>
            <Input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim (opcional)</label>
            <Input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground block mb-1">Imagem</label>
            <Input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} required />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} className="grad-neon text-primary-foreground">
              <Upload className="w-4 h-4 mr-2" /> {busy ? "Enviando..." : "Publicar anúncio"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="card-elev p-6">
        <h2 className="text-lg font-semibold mb-4">Anúncios cadastrados ({ads.length})</h2>
        <div className="space-y-2">
          {ads.map(ad => (
            <div key={ad.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border/40">
              <img src={ad.image_url} alt="" className="w-20 h-12 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{ad.title}</div>
                <div className="text-xs text-muted-foreground">
                  {ad.slot} · {ad.duration_sec}s {ad.team_id && `· 🎯 ${ad.team_id}`} · {ad.active ? "✅ ativo" : "⏸ pausado"}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => toggle(ad)}>
                {ad.active ? "Pausar" : "Ativar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(ad)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          {ads.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum anúncio cadastrado.</p>}
        </div>
      </Card>
    </>
  );
}
