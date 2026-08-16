import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { LiveTactilePitch } from "@/components/LiveTactilePitch";
import logoAcessivelJa from "@/assets/acessivel_ja_logo.jpg";
import { Volume2, VolumeX, ShieldAlert, Play, Square, RefreshCw, LogOut, ArrowRight, ShoppingCart } from "lucide-react";
import { AdSlot } from "@/components/AdSlot";
import { useAccess } from "@/hooks/useAccess";

export const Route = createFileRoute("/acessivel-ja")({ component: AcessivelJaPage });

interface MatchData {
  id: string;
  home: string;
  away: string;
  league: string;
  status_short: string | null;
  home_goals: number | null;
  away_goals: number | null;
}

function AcessivelJaPage() {
  const { isAdmin } = useAccess();
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [liveMatches, setLiveMatches] = useState<MatchData[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [email, setEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // 1. VERIFICAR AUTENTICAÇÃO E BUSCAR JOGOS
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Carregar jogos ao vivo e a partida mock
    const fetchMatches = () => {
      supabase
        .from("matches_cache")
        .select("id,home,away,league,status_short,home_goals,away_goals")
        .or("status_short.in.(1H,HT,2H,ET,P,LIVE),id.eq.af_mock_sincronizacao")
        .then(({ data }) => {
          if (data) {
            // Coloca a partida de teste (mock) no topo
            const sorted = [...data].sort((a, b) => {
              if (a.id === "af_mock_sincronizacao") return -1;
              if (b.id === "af_mock_sincronizacao") return 1;
              return 0;
            });
            setLiveMatches(sorted as any[]);
          }
        });
    };

    fetchMatches();
    const interval = setInterval(fetchMatches, 15000); // Atualiza lista a cada 15s

    return () => {
      authListener.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // 2. FUNÇÃO DE LOGIN VIA E-MAIL (EASY LOGIN) E GOOGLE
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Digite seu e-mail"); return; }
    setLoginLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/acessivel-ja" }
    });

    setLoginLoading(false);
    if (error) {
      toast.error("Erro ao enviar link: " + error.message);
    } else {
      toast.success("Link de acesso enviado para o seu e-mail! Verifique sua caixa de entrada.");
    }
  };

  const handleGoogleLogin = async () => {
    setLoginLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/acessivel-ja",
      });
      if (result.error) {
        toast.error("Erro no login: " + result.error.message);
        setLoginLoading(false);
      }
    } catch (err) {
      toast.error((err as Error).message);
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setSelectedMatch(null);
    toast.success("Logoff efetuado!");
  };

  // 3. COMANDOS DO HARDWARE DA MAQUETE
  const triggerHoming = async () => {
    if (!selectedMatch) return;
    try {
      const { error } = await supabase
        .from("match_live_states" as any)
        .upsert({
          match_id: selectedMatch.id,
          last_event: "homing",
          event_desc: "Calibração mecânica iniciada na maquete física. O ímã está retornando à posição zero.",
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      toast.success("Comando de calibração enviado para a maquete!");
    } catch (e) {
      toast.error("Erro ao calibrar: " + (e as Error).message);
    }
  };

  const triggerPresentation = async () => {
    if (!selectedMatch) return;
    try {
      const { error } = await supabase
        .from("match_live_states" as any)
        .upsert({
          match_id: selectedMatch.id,
          last_event: "presentation",
          event_desc: "Iniciando modo apresentação do campo. Siga as orientações sonoras.",
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      toast.success("Maquete iniciou a apresentação do campo!");
    } catch (e) {
      toast.error("Erro ao iniciar apresentação: " + (e as Error).message);
    }
  };

  const triggerStop = async () => {
    if (!selectedMatch) return;
    try {
      const { error } = await supabase
        .from("match_live_states" as any)
        .upsert({
          match_id: selectedMatch.id,
          ball_x: 50.0,
          ball_y: 50.0,
          last_event: "normal",
          event_desc: "Partida pausada no centro do campo.",
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      toast.info("Movimentação interrompida.");
    } catch (e) {
      toast.error("Erro ao pausar: " + (e as Error).message);
    }
  };

  if (loadingSession) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando canal acessível...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117] text-[#c9d1d9]">
      <Toaster richColors />
      <Header />

      {/* BANNER ADS DE MONETIZAÇÃO (TOPO) */}
      <div className="w-full flex justify-center py-4 bg-[#161b22]/50 border-b border-border/30">
        <AdSlot slot="AD_TOP_01" className="w-full max-w-4xl px-4" />
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        {/* LOGO E APRESENTAÇÃO DA MARCA */}
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border/30 flex-wrap sm:flex-nowrap">
          <img src={logoAcessivelJa} alt="acessivel.ja" className="w-20 h-20 rounded-2xl border-2 border-primary/50 object-cover shadow-[0_0_15px_rgba(0,255,135,0.2)]" />
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
              acessivel.<span className="text-primary">ja</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Plataforma inclusiva de narração sonora e transmissão tátil para pessoas com deficiência visual.
            </p>
          </div>
        </div>

        {/* CASO NÃO LOGADO: EXIBIR TELA DE LOGIN ACESSÍVEL */}
        {!session ? (
          <Card className="card-elev p-8 max-w-md mx-auto border-border/40 bg-[#161b22]">
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Acesse sua Conta</h2>
            <p className="text-xs text-muted-foreground text-center mb-6">
              Para vincular sua maquete física à sua conta e começar a jogar.
            </p>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label htmlFor="email-login" className="block text-xs uppercase tracking-wider font-bold mb-2">Seu e-mail</label>
                <Input 
                  type="email" 
                  id="email-login" 
                  placeholder="Ex: joao@email.com" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-[#0d1117] border-border/40 text-white focus:border-primary"
                  required
                />
              </div>
              <Button type="submit" disabled={loginLoading} className="w-full grad-neon text-primary-foreground font-bold">
                {loginLoading ? "Enviando..." : "Receber link por E-mail"}
              </Button>
            </form>

            <div className="relative my-6 text-center">
              <span className="absolute inset-x-0 top-1/2 h-[1px] bg-border/40 -translate-y-1/2" />
              <span className="relative bg-[#161b22] px-3 text-xs text-muted-foreground uppercase">ou</span>
            </div>

            <Button onClick={handleGoogleLogin} disabled={loginLoading} className="w-full bg-white text-black hover:bg-white/90 font-bold">
              Entrar com conta do Google
            </Button>
          </Card>
        ) : (
          /* CASO LOGADO: EXIBIR PAINEL DE CONTROLE E JOGOS */
          <div className="space-y-8">
            {/* SAUDAÇÃO E LOGOUT */}
            <div className="flex items-center justify-between bg-[#161b22] p-4 rounded-xl border border-border/30">
              <span className="text-xs font-semibold text-muted-foreground">
                Logado como: <span className="text-white font-bold">{session.user.email}</span>
              </span>
              <Button variant="ghost" size="xs" onClick={handleLogout} className="text-destructive hover:bg-destructive/10">
                <LogOut className="w-4 h-4 mr-1" /> Sair
              </Button>
            </div>

            {/* SELEÇÃO DO JOGO */}
            {!selectedMatch ? (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  📻 Selecione uma Partida ao Vivo
                </h2>
                <p className="text-xs text-muted-foreground">
                  Selecione abaixo o jogo que você está assistindo na TV para calibrar a maquete física e iniciar a narração.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  {liveMatches.map(m => {
                    const isMock = m.id === "af_mock_sincronizacao";
                    return (
                      <Card 
                        key={m.id} 
                        className={`p-5 border-border/30 bg-[#161b22] hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between ${
                          isMock ? "border-primary/50 bg-gradient-to-br from-primary/10 to-transparent shadow-[0_0_15px_-8px_rgba(0,255,135,0.4)]" : ""
                        }`}
                        onClick={() => setSelectedMatch(m)}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className={isMock ? "text-primary border-primary/40 bg-primary/5" : "text-destructive border-destructive/40 bg-destructive/5"}>
                              {isMock ? "🧪 TESTE FÁBRICA" : "🔴 AO VIVO"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground uppercase">{m.league}</span>
                          </div>
                          <h3 className="text-lg font-bold text-white mt-1">
                            {m.home} vs {m.away}
                          </h3>
                        </div>
                        <div className="mt-4 flex justify-between items-center border-t border-border/30 pt-3">
                          <span className="text-xs font-semibold text-muted-foreground">Placar atual:</span>
                          <span className="font-mono text-base font-black text-white">
                            {m.home_goals ?? 0} × {m.away_goals ?? 0}
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                  {liveMatches.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center col-span-2 py-8">
                      Nenhum jogo ao vivo encontrado no momento. Utilize a partida de testes "Flamengo vs Grêmio" acima para simular a maquete.
                    </p>
                  )}
                </div>
              </section>
            ) : (
              /* MESA SELECIONADA - JOYSTICK E AUDIO-GUIA */
              <div className="space-y-6">
                {/* BOTÃO PARA VOLTAR/TROCAR DE JOGO */}
                <Button variant="outline" size="sm" onClick={() => setSelectedMatch(null)}>
                  ← Trocar de Jogo / Escolher outro placar
                </Button>

                {/* PASSO A PASSO SONORO INICIAL */}
                <Card className="p-5 border-primary/30 bg-primary/5 text-primary text-xs flex flex-col gap-2 leading-relaxed">
                  <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                    📖 Guia de Inicialização Tátil (Acessível)
                  </h3>
                  <p>1. Ligue sua maquete física do campo na tomada de energia.</p>
                  <p>2. Certifique-se de que o computador local está rodando o script da ponte WebSocket.</p>
                  <p>3. Clique no botão <b>"Calibrar Mesa"</b> para alinhar os eixos da maquete física na posição de partida.</p>
                  <p>4. Se for a primeira vez usando, clique em <b>"Apresentação da Mesa"</b> para ensinar a geografia física do campo ao usuário cego guiando o dedo dele nos sulcos.</p>
                </Card>

                {/* BOTÕES DE COMANDO DA MAQUETE */}
                {isAdmin ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="lg" onClick={triggerHoming} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex flex-col items-center justify-center p-4 gap-1.5 h-auto">
                      <RefreshCw className="w-5 h-5 animate-spin" /> Calibrar Mesa
                    </Button>
                    <Button size="lg" onClick={triggerPresentation} className="bg-primary text-primary-foreground font-bold text-xs flex flex-col items-center justify-center p-4 gap-1.5 h-auto">
                      <Play className="w-5 h-5" /> Apresentar Campo
                    </Button>
                    <Button size="lg" onClick={triggerStop} variant="destructive" className="font-bold text-xs flex flex-col items-center justify-center p-4 gap-1.5 h-auto">
                      <Square className="w-5 h-5" /> Parar
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/20 rounded-lg text-xs border border-border/40 text-muted-foreground text-center">
                    📢 <b>Modo Ouvinte Ativo</b>: Conecte os fones de ouvido para ouvir as jogadas. Os botões de calibração mecânica são reservados para o administrador da maquete.
                  </div>
                )}

                {/* MESA VIRTUAL / CAMPO DE FUTEBOL E NARRADOR */}
                <LiveTactilePitch 
                  matchId={selectedMatch.id}
                  isAdmin={!!isAdmin} // Permite interatividade no joystick da tela apenas se for Admin
                  homeName={selectedMatch.home}
                  awayName={selectedMatch.away}
                />
              </div>
            )}
          </div>
        )}

        {/* SEÇÃO SOBRE A PARCERIA MERCADO LIVRE */}
        <section className="mt-12 pt-8 border-t border-border/30">
          <Card className="p-6 border-border/40 bg-[#161b22] flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 space-y-3">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                🛍️ Monte sua Própria Maquete
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O projeto **acessivel.ja** é open-source! Você pode baixar os modelos 3D gratuitamente do nosso repositório no GitHub para imprimir ou adquirir o kit completo montado em parceria com a Fábrica de Maquetes através do Mercado Livre.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a href="https://github.com/srgordo2005-dev/fabricamaquete" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="text-xs text-white border-border/40">
                    Ver Código no GitHub <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
                <a href="https://mercadolivre.com.br" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-[#fff159] hover:bg-[#ffe700] text-black font-bold text-xs flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" /> Comprar no Mercado Livre
                  </Button>
                </a>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <ResponsibleFooter />
    </div>
  );
}
