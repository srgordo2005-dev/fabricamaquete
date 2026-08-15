import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/useAccess";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Trash2, Lock, Plus, Shield, ShieldOff, Users, MessageSquare, Mail, BarChart3, Megaphone, Newspaper } from "lucide-react";
import {
  getAdminStats, listAdminUsers, adminUpdateUser, adminToggleAdminRole,
  listRecentChat, adminDeleteChat, type AdminUserRow, type AdminChatRow,
} from "@/lib/admin.functions";
import { BADGES } from "@/hooks/useProfile";
import { AdsPanel } from "@/components/admin/AdsPanel";
import { NewsPanel } from "@/components/admin/NewsPanel";

export const Route = createFileRoute("/totaladmin")({ component: AdminPage });

interface AllowedEmail { id: string; email: string; created_at: string }
type Tab = "stats" | "users" | "chat" | "emails" | "ads" | "news";

function AdminPage() {
  const { user, isAdmin, loading } = useAccess();
  const [tab, setTab] = useState<Tab>("stats");

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!user) return <Locked title="Login necessário" admin={false} />;
  if (!isAdmin) return <Locked title="Acesso negado" admin />;

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster richColors />
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        <h1 className="text-3xl font-bold mb-2">Painel Admin</h1>
        <p className="text-muted-foreground mb-6">Gestão completa da plataforma.</p>

        <div className="flex gap-1 overflow-x-auto mb-6 border-b border-border">
          {[
            { id: "stats" as const,  label: "Métricas",  icon: BarChart3 },
            { id: "users" as const,  label: "Usuários",  icon: Users },
            { id: "chat" as const,   label: "Chat",      icon: MessageSquare },
            { id: "emails" as const, label: "E-mails",   icon: Mail },
            { id: "ads" as const,    label: "Anúncios",  icon: Megaphone },
            { id: "news" as const,   label: "Notícias",  icon: Newspaper },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${tab === t.id ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "stats" && <StatsPanel />}
        {tab === "users" && <UsersPanel currentUserId={user.id} />}
        {tab === "chat" && <ChatPanel />}
        {tab === "emails" && <EmailsPanel userId={user.id} />}
        {tab === "ads" && <AdsPanel />}
        {tab === "news" && <NewsPanel userId={user.id} />}
      </main>
      <ResponsibleFooter />
    </div>
  );
}

function Locked({ title, admin }: { title: string; admin: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="card-elev p-8 max-w-md text-center">
        <Lock className={`w-12 h-12 mx-auto mb-4 ${admin ? "text-destructive" : "text-primary"}`} />
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        {!admin && <Link to="/auth"><Button className="grad-neon text-primary-foreground">Entrar</Button></Link>}
        {admin && <p className="text-muted-foreground">Apenas administradores.</p>}
      </Card>
    </div>
  );
}

function StatsPanel() {
  const [s, setS] = useState<Awaited<ReturnType<typeof getAdminStats>> | null>(null);
  useEffect(() => { getAdminStats().then(setS).catch(e => toast.error(String(e))); }, []);
  if (!s) return <p className="text-muted-foreground">Carregando métricas…</p>;
  const items = [
    { label: "Usuários",       value: s.users ?? 0,       icon: "👥" },
    { label: "Palpites",       value: s.predictions ?? 0, icon: "🏆" },
    { label: "Votos em jogos", value: s.votes ?? 0,       icon: "🗳️" },
    { label: "Mensagens chat", value: s.chats ?? 0,       icon: "💬" },
    { label: "Apostas (sim.)", value: s.bets ?? 0,        icon: "🎯" },
  ];
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
      {items.map(i => (
        <Card key={i.label} className="p-5">
          <div className="text-3xl mb-1">{i.icon}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{i.label}</div>
          <div className="text-3xl font-bold num">{Number(i.value ?? 0).toLocaleString("pt-BR")}</div>
        </Card>
      ))}
    </div>
  );
}

function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try { setRows(await listAdminUsers({ data: { search } })); }
    catch (e) { toast.error(String(e)); }
    finally { setBusy(false); }
  }, [search]);
  useEffect(() => { load(); }, [load]);

  const toggleAdmin = async (u: AdminUserRow) => {
    if (!confirm(`${u.is_admin ? "Remover" : "Conceder"} admin para ${u.display_name || u.username}?`)) return;
    try { await adminToggleAdminRole({ data: { user_id: u.user_id, make_admin: !u.is_admin } }); toast.success("Atualizado"); load(); }
    catch (e) { toast.error(String(e)); }
  };

  const toggleBadge = async (u: AdminUserRow, badgeId: string) => {
    const next = u.badges.includes(badgeId) ? u.badges.filter(b => b !== badgeId) : [...u.badges, badgeId];
    try { await adminUpdateUser({ data: { user_id: u.user_id, badges: next } }); load(); }
    catch (e) { toast.error(String(e)); }
  };

  const setXp = async (u: AdminUserRow, xp: number) => {
    try { await adminUpdateUser({ data: { user_id: u.user_id, xp } }); toast.success("XP atualizado"); load(); }
    catch (e) { toast.error(String(e)); }
  };

  return (
    <Card className="p-4">
      <div className="flex gap-2 mb-4">
        <Input placeholder="Buscar por nome / username..." value={search} onChange={e => setSearch(e.target.value)} />
        <Button onClick={load} disabled={busy} variant="outline">Buscar</Button>
      </div>
      <div className="text-xs text-muted-foreground mb-2">{rows.length} usuários</div>
      <div className="divide-y divide-border">
        {rows.map(u => (
          <div key={u.user_id} className="py-3">
            <div className="flex items-center gap-3 flex-wrap">
              {u.avatar_url
                ? <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                : <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-xs">{(u.display_name || u.username || "?")[0]}</div>}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{u.display_name || "(sem nome)"} {u.is_admin && <Shield className="inline w-3.5 h-3.5 text-primary ml-1" />}</div>
                <div className="text-xs text-muted-foreground truncate">@{u.username || "—"} · XP {u.xp} · {u.badges.length} badges {u.favorite_team && `· ⚽ ${u.favorite_team}`}</div>
              </div>
              <div className="flex items-center gap-1">
                <Input type="number" defaultValue={u.xp} className="w-24 h-8 text-xs"
                  onBlur={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v !== u.xp) setXp(u, v); }} />
                <Button size="sm" variant="outline" onClick={() => setEditing(editing === u.user_id ? null : u.user_id)}>Badges</Button>
                <Button size="sm" variant={u.is_admin ? "destructive" : "outline"} onClick={() => toggleAdmin(u)}
                  disabled={u.user_id === currentUserId && u.is_admin}>
                  {u.is_admin ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            {editing === u.user_id && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {BADGES.map(b => {
                  const has = u.badges.includes(b.id);
                  return (
                    <button key={b.id} onClick={() => toggleBadge(u, b.id)}
                      className={`text-left p-2 rounded text-xs flex items-center gap-1.5 border transition-colors ${has ? "border-primary bg-primary/10" : "border-border/40 hover:bg-muted/40"}`}>
                      <span>{b.icon}</span><span className="truncate">{b.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && !busy && <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário.</p>}
      </div>
    </Card>
  );
}

function ChatPanel() {
  const [rows, setRows] = useState<AdminChatRow[]>([]);
  const load = useCallback(async () => {
    try { setRows(await listRecentChat()); } catch (e) { toast.error(String(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const del = async (id: string) => {
    if (!confirm("Remover esta mensagem?")) return;
    try { await adminDeleteChat({ data: { id } }); toast.success("Removida"); setRows(r => r.filter(x => x.id !== id)); }
    catch (e) { toast.error(String(e)); }
  };
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold">Últimas {rows.length} mensagens</h2>
        <Button size="sm" variant="outline" onClick={load}>Atualizar</Button>
      </div>
      <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
        {rows.map(c => (
          <div key={c.id} className="py-2.5 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">{c.display_name}</strong> · {new Date(c.created_at).toLocaleString("pt-BR")} · <Link to="/match/$matchId" params={{ matchId: c.match_id }} className="text-primary hover:underline">{c.match_id.slice(0, 12)}…</Link>
              </div>
              <div className="text-sm break-words">{c.message}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => del(c.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sem mensagens.</p>}
      </div>
    </Card>
  );
}

function EmailsPanel({ userId }: { userId: string }) {
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("allowed_emails").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setEmails(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newEmail.trim()) return; setBusy(true);
    const { error } = await supabase.from("allowed_emails").insert({ email: newEmail.trim().toLowerCase(), added_by: userId });
    if (error) toast.error(error.message); else { toast.success("E-mail adicionado"); setNewEmail(""); load(); }
    setBusy(false);
  };
  const remove = async (id: string, email: string) => {
    if (!confirm(`Remover ${email}?`)) return;
    const { error } = await supabase.from("allowed_emails").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  };

  return (
    <>
      <Card className="card-elev p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Adicionar e-mail à whitelist</h2>
        <form onSubmit={add} className="flex gap-2">
          <Input type="email" placeholder="usuario@exemplo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
          <Button type="submit" disabled={busy} className="grad-neon text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
        </form>
      </Card>
      <Card className="card-elev p-6">
        <h2 className="text-lg font-semibold mb-4">E-mails autorizados ({emails.length})</h2>
        <div className="space-y-2">
          {emails.map(e => (
            <div key={e.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/40">
              <span className="font-mono text-sm">{e.email}</span>
              <Button size="sm" variant="ghost" onClick={() => remove(e.id, e.email)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
          {emails.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum e-mail cadastrado.</p>}
        </div>
      </Card>
    </>
  );
}
