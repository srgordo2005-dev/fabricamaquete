import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/useAccess";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { 
  Trash2, Lock, Plus, Shield, ShieldOff, Users, MessageSquare, Mail, 
  BarChart3, Megaphone, Newspaper, Sliders, Battery, ArrowRight 
} from "lucide-react";
import {
  getAdminStats, listAdminUsers, adminUpdateUser, adminToggleAdminRole,
  listRecentChat, adminDeleteChat, type AdminUserRow, type AdminChatRow,
} from "@/lib/admin.functions";
import { BADGES } from "@/hooks/useProfile";
import { AdsPanel } from "@/components/admin/AdsPanel";
import { NewsPanel } from "@/components/admin/NewsPanel";

export const Route = createFileRoute("/admintroco-ja")({ component: AdminPage });

interface AllowedEmail { id: string; email: string; created_at: string }
type Tab = "maquete" | "stats" | "users" | "chat" | "emails" | "ads" | "news";

function AdminPage() {
  if (typeof window === "undefined") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  const { user, isAdmin, loading } = useAccess();
  const [tab, setTab] = useState<Tab>("maquete");

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando painel de fábrica...</div>;

  const isCreatorAdmin = !!user && (user.email === "srgordo2005@gmail.com" || isAdmin);

  if (!user || !isCreatorAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#eef2f7] via-[#f8fafc] to-[#dce4ee] text-[#0f172a]">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="p-8 max-w-md text-center bg-white border border-slate-200 shadow-2xl rounded-3xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-100 border border-red-300 text-red-600 grid place-items-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Acesso Restrito — Fábrica de Maquetes</h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              O painel <strong>ADMINTROCO.JÁ</strong> e os testes mecânicos são exclusivos da conta de administrador <strong>srgordo2005@gmail.com</strong>.
            </p>
            <Link to="/acessivel-ja">
              <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold rounded-xl py-3 mt-2">
                Ir para o App Acessível.Já <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </Card>
        </div>
        <ResponsibleFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Toaster richColors />
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              ADMINTROCO.<span className="text-blue-600">JÁ</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Painel de Controle de Fábrica da Maquete Tátil — Exclusivo <span className="font-mono font-bold text-slate-800">srgordo2005@gmail.com</span>
            </p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono text-xs py-1 px-3">
            👑 ADMIN MASTER CONECTADO
          </Badge>
        </div>

        <div className="flex gap-1 overflow-x-auto mb-6 border-b border-slate-200 pb-1">
          {[
            { id: "maquete" as const, label: "Fábrica & Calibração", icon: Sliders },
            { id: "stats" as const,   label: "Métricas",           icon: BarChart3 },
            { id: "users" as const,   label: "Usuários",           icon: Users },
            { id: "chat" as const,    label: "Chat",               icon: MessageSquare },
            { id: "emails" as const,  label: "E-mails Whitelist",  icon: Mail },
            { id: "ads" as const,     label: "Anúncios",           icon: Megaphone },
            { id: "news" as const,    label: "Notícias",           icon: Newspaper },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all flex items-center gap-2 rounded-t-lg ${tab === t.id ? "border-blue-600 text-blue-600 bg-blue-50/80" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
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
        {tab === "maquete" && <MaquetePanel />}
      </main>
      <ResponsibleFooter />
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
        <Card key={i.label} className="p-5 border border-slate-200 bg-white shadow-sm rounded-2xl">
          <div className="text-3xl mb-1">{i.icon}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{i.label}</div>
          <div className="text-3xl font-black text-slate-900">{Number(i.value ?? 0).toLocaleString("pt-BR")}</div>
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
    <Card className="p-5 border border-slate-200 bg-white shadow-sm rounded-2xl">
      <div className="flex gap-2 mb-4">
        <Input placeholder="Buscar por nome / username..." value={search} onChange={e => setSearch(e.target.value)} className="bg-slate-50 border-slate-300" />
        <Button onClick={load} disabled={busy} variant="outline">Buscar</Button>
      </div>
      <div className="text-xs font-bold text-slate-500 mb-2">{rows.length} usuários</div>
      <div className="divide-y divide-slate-100">
        {rows.map(u => (
          <div key={u.user_id} className="py-3">
            <div className="flex items-center gap-3 flex-wrap">
              {u.avatar_url
                ? <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                : <div className="w-9 h-9 rounded-full bg-slate-200 grid place-items-center text-xs font-bold">{(u.display_name || u.username || "?")[0]}</div>}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate">{u.display_name || "(sem nome)"} {u.is_admin && <Shield className="inline w-3.5 h-3.5 text-blue-600 ml-1" />}</div>
                <div className="text-xs text-slate-500 truncate">@{u.username || "—"} · XP {u.xp} · {u.badges.length} badges {u.favorite_team && `· ⚽ ${u.favorite_team}`}</div>
              </div>
              <div className="flex items-center gap-1">
                <Input type="number" defaultValue={u.xp} className="w-24 h-8 text-xs bg-slate-50"
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
                      className={`text-left p-2 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${has ? "border-blue-500 bg-blue-50 font-bold" : "border-slate-200 hover:bg-slate-50"}`}>
                      <span>{b.icon}</span><span className="truncate">{b.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && !busy && <p className="text-sm text-slate-400 text-center py-6">Nenhum usuário.</p>}
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
    <Card className="p-5 border border-slate-200 bg-white shadow-sm rounded-2xl">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-slate-900">Últimas {rows.length} mensagens</h2>
        <Button size="sm" variant="outline" onClick={load}>Atualizar</Button>
      </div>
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {rows.map(c => (
          <div key={c.id} className="py-2.5 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">
                <strong className="text-slate-900">{c.display_name}</strong> · {new Date(c.created_at).toLocaleString("pt-BR")} · <Link to="/match/$matchId" params={{ matchId: c.match_id }} className="text-blue-600 hover:underline">{c.match_id.slice(0, 12)}…</Link>
              </div>
              <div className="text-sm break-words text-slate-800">{c.message}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => del(c.id)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Sem mensagens.</p>}
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
      <Card className="p-6 mb-6 border border-slate-200 bg-white shadow-sm rounded-2xl">
        <h2 className="text-lg font-bold mb-4">Adicionar e-mail à whitelist</h2>
        <form onSubmit={add} className="flex gap-2">
          <Input type="email" placeholder="usuario@exemplo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className="bg-slate-50 border-slate-300" />
          <Button type="submit" disabled={busy} className="bg-blue-600 text-white font-bold"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
        </form>
      </Card>
      <Card className="p-6 border border-slate-200 bg-white shadow-sm rounded-2xl">
        <h2 className="text-lg font-bold mb-4">E-mails autorizados ({emails.length})</h2>
        <div className="space-y-2">
          {emails.map(e => (
            <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-mono text-sm font-semibold text-slate-800">{e.email}</span>
              <Button size="sm" variant="ghost" onClick={() => remove(e.id, e.email)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          ))}
          {emails.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Nenhum e-mail cadastrado.</p>}
        </div>
      </Card>
    </>
  );
}

function MaquetePanel() {
  const [macs, setMacs] = useState<any[]>([
    { mac_address: "20:9b:a9:8b:69:58", battery_level: 100, battery_voltage: 4.15, status: "online" }
  ]);
  const [selectedMac, setSelectedMac] = useState("20:9b:a9:8b:69:58");
  const [xVal, setXVal] = useState(50.0);
  const [yVal, setYVal] = useState(50.0);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("pt-BR");
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  };

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isEspConnected, setIsEspConnected] = useState<boolean>(false);
  const [lastPing, setLastPing] = useState<number>(0);

  useEffect(() => {
    const socket = new WebSocket("wss://fabricamaquete.onrender.com/ws/campo");
    
    socket.onopen = () => {
      addLog("📡 Conectado ao Servidor Central (Aguardando resposta do ESP32)...");
      socket.send(JSON.stringify({ event: "register", mac: "web_admin", type: "controller", target: "all" }));
      if (selectedMac) {
        socket.send(JSON.stringify({ event: "ping", target: selectedMac, mac: selectedMac, from: "web_admin" }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventMacClean = data.mac ? String(data.mac).toLowerCase().replace(/[^a-f0-9]/g, "") : "";
        const selectedMacClean = selectedMac ? String(selectedMac).toLowerCase().replace(/[^a-f0-9]/g, "") : "";

        if (
          data.event === "heartbeat" || 
          data.event === "battery" || 
          data.event === "driver_ack" || 
          data.event === "register" ||
          data.event === "ping" ||
          data.status === "online" ||
          (eventMacClean && selectedMacClean && eventMacClean === selectedMacClean) ||
          (data.mac && String(data.mac).toLowerCase().replace(/[^a-f0-9]/g, "").includes("209ba98b6958"))
        ) {
          setIsEspConnected(true);
          setLastPing(Date.now());
          if (data.event === "driver_ack") {
            addLog(`✅ CONFIRMAÇÃO DO ESP32: ${data.msg || "Pulsos enviados ao NEMA 14!"}`);
            toast.success("✅ ESP32 CONFIRMOU: Pulsos enviados para o Driver NEMA 14!");
          }
        }
      } catch(e) {}
    };

    socket.onclose = () => {
      setIsEspConnected(false);
      addLog("🔴 Conexão encerrada com a Mesa Tátil");
    };

    socket.onerror = () => {
      setIsEspConnected(false);
    };

    setWs(socket);

    // Envia solicitação PING a cada 2s para obter o status em tempo real
    const interval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN && selectedMac) {
        socket.send(JSON.stringify({ event: "ping", target: selectedMac, mac: selectedMac, from: "web_admin" }));
      }
      setLastPing(prev => {
        if (prev > 0 && Date.now() - prev > 6000) {
          setIsEspConnected(false);
        }
        return prev;
      });
    }, 2000);

    return () => { 
      socket.close(); 
      clearInterval(interval);
    };
  }, [selectedMac]);

  const sendCoords = async (x: number, y: number, label: string = "Manual") => {
    setXVal(x);
    setYVal(y);
    addLog(`Enviando X: ${x}%, Y: ${y}% (${label})`);
    
    const payload = JSON.stringify({
      x: x, y: y, event: "move", haptic: label.includes("Gol"), type: label.includes("Gol") ? "gol" : "toque"
    });

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      toast.success(`Enviado via Nuvem -> X: ${x}%, Y: ${y}%`);
    }

    // Envio direto via Wi-Fi Local se conectado no Hotspot 192.168.4.1
    try {
      fetch(`http://192.168.4.1/move?x=${x}&y=${y}`, { mode: 'no-cors' }).catch(() => {});
    } catch(e) {}
  };

  const jog = (axis: "x" | "y", amount: number) => {
    let newVal = axis === "x" ? xVal + amount : yVal + amount;
    newVal = Math.max(0.0, Math.min(100.0, parseFloat(newVal.toFixed(2))));
    sendCoords(
      axis === "x" ? newVal : xVal,
      axis === "y" ? newVal : yVal,
      `Ajuste ${axis.toUpperCase()} ${amount > 0 ? "+" : ""}${amount}%`
    );
  };

  const presets = [
    { label: "Meio de Campo (Centro)", x: 50.0, y: 50.0 },
    { label: "Escanteio Superior Esquerdo", x: 2.0, y: 2.0 },
    { label: "Escanteio Inferior Esquerdo", x: 2.0, y: 98.0 },
    { label: "Escanteio Superior Direito", x: 98.0, y: 2.0 },
    { label: "Escanteio Inferior Direito", x: 98.0, y: 98.0 },
    { label: "Gol da Esquerda (Home)", x: 2.0, y: 50.0 },
    { label: "Gol da Direita (Away)", x: 98.0, y: 50.0 },
  ];

  // Carrega a lista de maquetes do banco de dados
  useEffect(() => {
    supabase
      .from("maquete_status" as any)
      .select("*")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMacs(data);
          if (!selectedMac) setSelectedMac(data[0].mac_address);
          
          // Checa se a maquete enviou dados nos últimos 2 minutos
          const lastUp = data[0].updated_at ? new Date(data[0].updated_at).getTime() : 0;
          if (Date.now() - lastUp < 120000) {
            setIsEspConnected(true);
            setLastPing(Date.now());
          }
        }
      });
  }, []);

  const handleAddMac = async () => {
    const newMacInput = window.prompt("Digite o MAC Address da nova mesa tátil (ex: 68:09:47:44:46:C0):", "68:09:47:44:46:C0");
    if (!newMacInput || !newMacInput.trim()) return;
    const cleanMac = newMacInput.trim().toUpperCase();

    try {
      await supabase.from("maquete_status" as any).upsert({
        mac_address: cleanMac,
        battery_level: 100,
        battery_voltage: 4.20,
        updated_at: new Date().toISOString()
      });
    } catch (e) {}

    setMacs(prev => {
      if (prev.some(m => m.mac_address === cleanMac)) return prev;
      return [...prev, { mac_address: cleanMac, battery_level: 100, battery_voltage: 4.20 }];
    });
    setSelectedMac(cleanMac);
    toast.success(`🎉 Nova Mesa (${cleanMac}) cadastrada na Fábrica!`);
  };

  const handleDeleteMac = async () => {
    if (!selectedMac) {
      toast.error("Nenhuma mesa selecionada para excluir.");
      return;
    }
    if (!confirm(`⚠️ Tem certeza que deseja excluir permanentemente a mesa MAC ${selectedMac}?`)) return;

    try {
      await supabase.from("maquete_status" as any).delete().eq("mac_address", selectedMac);
    } catch (e) {}

    setMacs(prev => {
      const filtered = prev.filter(m => m.mac_address !== selectedMac);
      if (filtered.length > 0) setSelectedMac(filtered[0].mac_address);
      else setSelectedMac("");
      return filtered;
    });
    toast.success(`🗑️ Mesa ${selectedMac} excluída com sucesso!`);
  };

  const handleResetWifi = () => {
    if (!confirm(`📶 Deseja redefinir o Wi-Fi da mesa MAC ${selectedMac}? Sua conta permanecerá vinculada, mas o hotspot ACESSIVEL_JA_CONFIG será aberto para cadastrar uma nova rede.`)) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "reset_wifi", mac: selectedMac }));
      toast.success("⚡ Comando enviado! O ESP32 está reiniciando e abrindo a rede ACESSIVEL_JA_CONFIG.");
    }

    try {
      fetch("http://192.168.4.1/reset_wifi", { mode: "no-cors" }).catch(() => {});
    } catch (e) {}
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="p-6 bg-white border border-slate-200 shadow-xl rounded-2xl">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
              🔌 Seletor de Maquete Física da Fábrica (ESP32)
            </h2>
            <div className="flex items-center gap-2">
              <Button size="xs" onClick={handleAddMac} className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] rounded-lg">
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Mesa
              </Button>
              <Button size="xs" variant="destructive" onClick={handleDeleteMac} className="font-extrabold text-[11px] rounded-lg">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir Mesa
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Selecione a placa ativa para calibrar os fins de curso nos eixos.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold mb-2">Maquete do Cliente / Fábrica</label>
              <select 
                value={selectedMac}
                onChange={e => setSelectedMac(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono text-slate-900 font-bold"
              >
                {macs.map(m => (
                  <option key={m.mac_address} value={m.mac_address}>
                    {m.mac_address} - Bat: {m.battery_level}% ({m.battery_voltage ? Number(m.battery_voltage).toFixed(2) : '4.15'}V)
                  </option>
                ))}
                {macs.length === 0 && <option value="">Nenhuma mesa cadastrada. Clique em + Adicionar Mesa.</option>}
              </select>
            </div>
            
            {macs.length > 0 && selectedMac && (
              <div className="space-y-3 mt-3">
                <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isEspConnected 
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900" 
                    : "bg-red-50 border-red-300 text-red-900"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-3.5 h-3.5 rounded-full inline-block ${
                      isEspConnected ? "bg-emerald-600 animate-pulse" : "bg-red-600 animate-pulse"
                    }`} />
                    <div className="text-xs">
                      <span className="font-black block uppercase tracking-wider text-slate-900">
                        {isEspConnected ? "🟢 MESA TÁTIL CONECTADA (ONLINE)" : "🔴 MESA TÁTIL DESCONECTADA (OFFLINE)"}
                      </span>
                      <span className="text-[11px] opacity-80 font-mono">
                        MAC: {selectedMac} | Bateria: {macs.find(m => m.mac_address === selectedMac)?.battery_level || 100}%
                      </span>
                    </div>
                  </div>
                </div>

                {!isEspConnected && (
                  <div className="p-3 bg-red-100/70 border border-red-200 rounded-xl text-xs text-red-800 font-medium">
                    ⚠️ A mesa não conseguiu se conectar à rede <strong>RAFAEL</strong>. Verifique se a senha digitada no Wi-Fi está correta ou se a rede do roteador é de 2.4 GHz.
                  </div>
                )}

                <Button 
                  onClick={handleResetWifi}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl py-2.5 shadow-sm flex items-center justify-center gap-2"
                >
                  📡 Trocar Wi-Fi da Mesa (Abrir Hotspot ACESSIVEL_JA_CONFIG)
                </Button>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-2">QR Code Oficial do Adesivo 3D</span>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('https://resulta-app.vercel.app/acessivel-ja?mac=' + selectedMac)}`} 
                    alt="QR Code Maquete"
                    className="w-36 h-36 mx-auto rounded-xl border border-slate-300 p-1 bg-white shadow-sm"
                  />
                  <p className="text-[11px] font-mono text-slate-700 font-bold mt-2">MAC: {selectedMac}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* CONTROLES MANUAIS COM SLIDERS */}
        <Card className="p-6 bg-white border border-slate-200 shadow-xl rounded-2xl">
          <h2 className="text-lg font-bold text-slate-900 mb-4">🎮 Calibração Manual de Fábrica (Sliders X / Y)</h2>
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-600 block mb-2">Eixo X (Comprimento) - Atual: {xVal}%</span>
              <div className="flex gap-1 flex-wrap mb-3">
                <Button size="xs" variant="outline" onClick={() => jog("x", -5.0)}>-5%</Button>
                <Button size="xs" variant="outline" onClick={() => jog("x", -1.0)}>-1%</Button>
                <span className="px-3 py-1 text-xs font-mono bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center shrink-0 w-16 text-slate-900 font-bold">{xVal}%</span>
                <Button size="xs" variant="outline" onClick={() => jog("x", 1.0)}>+1%</Button>
                <Button size="xs" variant="outline" onClick={() => jog("x", 5.0)}>+5%</Button>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-slate-500 font-mono">0%</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="1"
                  value={xVal}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    sendCoords(val, yVal, `Slider X ${val}%`);
                  }}
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                />
                <span className="text-xs text-slate-500 font-mono">100%</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-600 block mb-2">Eixo Y (Largura) - Atual: {yVal}%</span>
              <div className="flex gap-1 flex-wrap mb-3">
                <Button size="xs" variant="outline" onClick={() => jog("y", -5.0)}>-5%</Button>
                <Button size="xs" variant="outline" onClick={() => jog("y", -1.0)}>-1%</Button>
                <span className="px-3 py-1 text-xs font-mono bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center shrink-0 w-16 text-slate-900 font-bold">{yVal}%</span>
                <Button size="xs" variant="outline" onClick={() => jog("y", 1.0)}>+1%</Button>
                <Button size="xs" variant="outline" onClick={() => jog("y", 5.0)}>+5%</Button>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-slate-500 font-mono">0%</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="1"
                  value={yVal}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    sendCoords(xVal, val, `Slider Y ${val}%`);
                  }}
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                />
                <span className="text-xs text-slate-500 font-mono">100%</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        {/* PRESETS DE CALIBRAÇÃO */}
        <Card className="p-6 bg-white border border-slate-200 shadow-xl rounded-2xl">
          <h2 className="text-lg font-bold text-slate-900 mb-2">📐 Presets de Calibração</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presets.map(p => (
              <Button 
                key={p.label}
                size="xs"
                variant="outline"
                onClick={() => sendCoords(p.x, p.y, p.label)}
                className="text-left justify-start text-[11px] p-2 font-semibold text-slate-800 border-slate-300 hover:bg-blue-50 rounded-xl"
              >
                📍 {p.label} <span className="text-[9px] font-mono text-blue-600 ml-auto">({p.x}%, {p.y}%)</span>
              </Button>
            ))}
          </div>
        </Card>

        {/* CAMPO DE CALIBRAÇÃO VIRTUAL 2D INTERATIVO */}
        <Card className="p-5 flex flex-col gap-3 bg-white border border-slate-200 shadow-xl rounded-2xl">
          <h2 className="text-xs uppercase tracking-wider font-extrabold text-slate-700">🖱️ Campo 2D Interativo (Clique para Mover a Maquete)</h2>
          <div 
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pctX = ((e.clientX - rect.left) / rect.width) * 100;
              const pctY = ((e.clientY - rect.top) / rect.height) * 100;
              sendCoords(
                parseFloat(Math.max(0, Math.min(100, pctX)).toFixed(1)),
                parseFloat(Math.max(0, Math.min(100, pctY)).toFixed(1)),
                "Clique Campo 2D"
              );
            }}
            className="relative w-full aspect-[1.8] bg-emerald-900 rounded-2xl border-2 border-emerald-700 overflow-hidden shadow-inner cursor-crosshair"
          >
            <div className="absolute inset-4 border border-white/30 pointer-events-none">
              <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/30" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] aspect-square rounded-full border border-white/30" />
            </div>
            <div 
              className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-blue-500 ring-4 ring-blue-400/50 shadow-[0_0_15px_#3b82f6] animate-pulse"
              style={{ left: `${xVal}%`, top: `${yVal}%` }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
