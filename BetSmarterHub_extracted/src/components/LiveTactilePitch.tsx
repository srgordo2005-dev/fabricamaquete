import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface LiveState {
  match_id: string;
  ball_x: number;
  ball_y: number;
  possession: string;
  last_event: string;
  event_desc: string;
  updated_at: string;
}

interface LiveTactilePitchProps {
  matchId: string;
  isAdmin: boolean;
  homeName: string;
  awayName: string;
}

export function LiveTactilePitch({ matchId, isAdmin, homeName, awayName }: LiveTactilePitchProps) {
  const [liveState, setLiveState] = useState<LiveState>({
    match_id: matchId,
    ball_x: 50.0,
    ball_y: 50.0,
    possession: "none",
    last_event: "normal",
    event_desc: "Jogo iniciado",
    updated_at: new Date().toISOString()
  });

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const throttleTimeout = useRef<NodeJS.Timeout | null>(null);

  // Síntese de Voz (Text-to-Speech)
  const speak = (text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Cancela falas anteriores para evitar fila acumulada
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.1; // Velocidade levemente aumentada para tempo real
    window.speechSynthesis.speak(utterance);
  };

  // 1. CONEXÃO COM O BANCO DE DADOS (SUPABASE REALTIME)
  useEffect(() => {
    // Busca inicial do estado
    supabase
      .from("match_live_states" as any)
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao buscar estado inicial:", error);
        } else if (data) {
          setLiveState(data as any);
        } else if (isAdmin) {
          // Se não existir o registro do jogo e for admin, inicializa no centro
          supabase
            .from("match_live_states" as any)
            .insert({
              match_id: matchId,
              ball_x: 50.0,
              ball_y: 50.0,
              possession: "none",
              last_event: "normal",
              event_desc: "Partida iniciada no centro do campo"
            })
            .then(() => {
              toast.info("Rastreamento ao vivo inicializado para este jogo.");
            });
        }
      });

    // Inscreve no canal em tempo real do Supabase
    const channel = supabase
      .channel(`live-pitch-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_live_states",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.new) {
            const newState = payload.new as LiveState;
            setLiveState(newState);

            // Anunciar eventos significativos e mudanças de descrição
            if (newState.event_desc) {
              setAnnouncement(newState.event_desc);
              speak(newState.event_desc);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (throttleTimeout.current) clearTimeout(throttleTimeout.current);
    };
  }, [matchId, isAdmin]);

  // 2. FUNÇÃO DE ATUALIZAÇÃO COM CONTROLE DE FLUXO (THROTTLE)
  const saveCoordinates = (x: number, y: number, event: string = "normal", desc: string = "") => {
    if (!isAdmin) return;

    // Atualiza estado local de imediato para a tela ficar fluída
    setLiveState(prev => ({
      ...prev,
      ball_x: x,
      ball_y: y,
      last_event: event,
      event_desc: desc || prev.event_desc
    }));

    if (throttleTimeout.current) return; // Aguarda o delay para não entupir a API

    throttleTimeout.current = setTimeout(() => {
      throttleTimeout.current = null;
      
      // Gera descrição baseada na região do campo se não for passada uma específica
      let finalDesc = desc;
      if (!finalDesc) {
        if (x < 30) finalDesc = `Bola na defesa do ${homeName}`;
        else if (x > 70) finalDesc = `Ataque perigoso do ${homeName}`;
        else finalDesc = "Troca de passes no meio de campo";
      }

      supabase
        .from("match_live_states" as any)
        .upsert({
          match_id: matchId,
          ball_x: x,
          ball_y: y,
          last_event: event,
          event_desc: finalDesc,
          updated_at: new Date().toISOString()
        })
        .catch(err => console.error("Erro ao salvar coordenadas:", err));
    }, 100); // 10 atualizações por segundo (altamente fluído)
  };

  // 3. EVENTOS DE ARRASTAR E CLICAR NO CAMPO
  const handlePositionUpdate = (clientX: number, clientY: number) => {
    if (!isAdmin || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    const xPixels = clientX - rect.left;
    const yPixels = clientY - rect.top;

    // Converte para percentual clampando de 0 a 100%
    const pctX = Math.max(0, Math.min(100, (xPixels / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, (yPixels / rect.height) * 100));

    saveCoordinates(parseFloat(pctX.toFixed(1)), parseFloat(pctY.toFixed(1)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isAdmin) return;
    isDragging.current = true;
    handlePositionUpdate(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      handlePositionUpdate(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Eventos Mobile Touch
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isAdmin) return;
    isDragging.current = true;
    if (e.touches.length > 0) {
      handlePositionUpdate(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging.current && e.touches.length > 0) {
      handlePositionUpdate(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Eventos rápidos (Atalhos de Placar/Vibração)
  const triggerQuickEvent = (type: string, description: string) => {
    let x = liveState.ball_x;
    let y = liveState.ball_y;

    if (type === "goal_home") { x = 98.0; y = 50.0; }
    else if (type === "goal_away") { x = 2.0; y = 50.0; }
    else if (type === "center") { x = 50.0; y = 50.0; }

    saveCoordinates(x, y, type.startsWith("goal") ? "goal" : type, description);
    speak(description);
  };

  return (
    <Card className="card-elev p-5 flex flex-col gap-4">
      {/* Cabeçalho do Rastreamento */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-primary hover:bg-primary/80 animate-pulse text-xs">
            📡 Campo Tátil Pro Conectado
          </Badge>
          <span className="text-xs text-muted-foreground num">
            Posição: X {liveState.ball_x}% | Y {liveState.ball_y}%
          </span>
        </div>

        {/* Controle de Narração de Voz */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            setVoiceEnabled(!voiceEnabled);
            if (!voiceEnabled) speak("Narração ativada");
          }}
          aria-label={voiceEnabled ? "Desativar narração por voz" : "Ativar narração por voz"}
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
          <span className="ml-1 text-xs">{voiceEnabled ? "Áudio Ligado" : "Mudo"}</span>
        </Button>
      </div>

      {/* Rótulo de acessibilidade para leitores de tela */}
      <div aria-live="assertive" className="sr-only">
        {announcement}
      </div>

      {/* Renderização do Campo de Futebol (CSS Grid/Flex) */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        className={`relative w-full aspect-[1.8] bg-emerald-950 rounded-lg border-2 border-emerald-800 overflow-hidden shadow-inner ${
          isAdmin ? "cursor-crosshair" : "pointer-events-none"
        }`}
      >
        {/* Marcações do Gramado */}
        <div className="absolute inset-y-0 left-0 right-0 flex">
          {Array.from({ length: 10 }).map((_, i) => (
            <div 
              key={i} 
              className={`flex-1 h-full ${i % 2 === 0 ? "bg-emerald-900/30" : "bg-transparent"}`}
            />
          ))}
        </div>

        {/* Linhas brancas clássicas de campo */}
        <div className="absolute inset-4 border border-white/30 pointer-events-none">
          {/* Linha Central */}
          <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/30" />
          
          {/* Círculo Central */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] aspect-square rounded-full border border-white/30 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>

          {/* Pequena e Grande Área da Esquerda (Home) */}
          <div className="absolute inset-y-[20%] left-0 w-[15%] border-y border-r border-white/30" />
          <div className="absolute inset-y-[35%] left-0 w-[6%] border-y border-r border-white/30" />

          {/* Pequena e Grande Área da Direita (Away) */}
          <div className="absolute inset-y-[20%] right-0 w-[15%] border-y border-l border-white/30" />
          <div className="absolute inset-y-[35%] right-0 w-[6%] border-y border-l border-white/30" />
        </div>

        {/* BOLA (Ponto luminoso dinâmico) */}
        <div 
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-white ring-4 ring-cyan-400 ring-offset-2 ring-offset-emerald-950 shadow-[0_0_15px_#22d3ee] transition-all duration-75 ease-out"
          style={{ 
            left: `${liveState.ball_x}%`, 
            top: `${liveState.ball_y}%` 
          }}
        />

        {/* Marcador de Posse de Bola (Gradiente na borda) */}
        {liveState.possession !== "none" && (
          <div 
            className={`absolute inset-0 border-2 pointer-events-none transition-colors duration-300 ${
              liveState.possession === "home" ? "border-primary/50" : "border-destructive/50"
            }`}
          />
        )}
      </div>

      {/* Caixa do Evento Atual (Descrição Acessível) */}
      <div className="p-3 bg-muted/40 rounded-lg flex flex-col gap-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
          Descrição em Tempo Real (Áudio):
        </span>
        <p className="text-sm font-semibold text-primary">
          📢 {liveState.event_desc || "Partida em andamento..."}
        </p>
      </div>

      {/* Painel Administrativo de Controle (Somente para Admin) */}
      {isAdmin && (
        <div className="border border-warning/40 bg-warning/5 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-warning text-sm font-semibold">
            <ShieldAlert className="w-4 h-4" /> Painel de Transmissão da Maquete (Modo Admin)
          </div>
          <p className="text-xs text-muted-foreground">
            Clique ou arraste no campo acima para mover o ímã físico. Use os botões rápidos para simular jogadas e disparar vibrações hápticas na maquete.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="xs" variant="secondary" onClick={() => triggerQuickEvent("center", "Jogo reiniciado no centro do campo")}>
              📍 Centralizar
            </Button>
            <Button size="xs" variant="success" onClick={() => triggerQuickEvent("goal_home", `GOL DO ${homeName.toUpperCase()}!`)}>
              ⚽ Gol {homeName}
            </Button>
            <Button size="xs" variant="success" onClick={() => triggerQuickEvent("goal_away", `GOL DO ${awayName.toUpperCase()}!`)}>
              ⚽ Gol {awayName}
            </Button>
            <Button size="xs" variant="destructive" onClick={() => triggerQuickEvent("foul", "Falta marcada! Vibração ativada na maquete")}>
              ⚠️ Falta
            </Button>
            <Button size="xs" variant="outline" onClick={() => triggerQuickEvent("corner", "Escanteio cobrado!")}>
              📐 Escanteio
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <Button size="xs" variant="ghost" className="text-left justify-start text-[11px]" 
              onClick={() => saveCoordinates(liveState.ball_x, liveState.ball_y, "possession_home", "Posse de bola com " + homeName)}>
              🏃 Posse: {homeName}
            </Button>
            <Button size="xs" variant="ghost" className="text-left justify-start text-[11px]" 
              onClick={() => saveCoordinates(liveState.ball_x, liveState.ball_y, "possession_away", "Posse de bola com " + awayName)}>
              🏃 Posse: {awayName}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
