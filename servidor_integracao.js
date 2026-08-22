/* ==========================================================================
   SERVIDO DE INTEGRAÇÃO - PONTE SUPABASE -> WEBSOCKET ESP32 (IOT POR MAC)
   Este servidor escuta as coordenadas em tempo real no Supabase
   e as repassa para o ESP32 via WebSockets com base no MAC Address cadastrado.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

// 1. CARREGAR VARIÁVEIS DE AMBIENTE (.env do app de apostas)
const envPath = path.join(__dirname, 'BetSmarterHub_extracted', '.env');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const matchUrl = line.match(/^\s*SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
    const matchKey = line.match(/^\s*SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\s]+)["']?/);
    if (matchUrl) supabaseUrl = matchUrl[1];
    if (matchKey) supabaseKey = matchKey[1];
  }
}

supabaseUrl = supabaseUrl || "https://gzakagtzfflwwoprystv.supabase.co";
supabaseKey = supabaseKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

console.log('----------------------------------------------------');
console.log('🔌 Conectando ao Supabase:', supabaseUrl);
console.log('----------------------------------------------------');

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. INICIAR SERVIDOR WEBSOCKET LOCAL / RENDER (Porta PORT ou 8080)
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`🚀 Servidor Ponte WebSocket rodando na porta ${PORT}`);
  console.log('👉 Endereço para o ESP32 se conectar: wss://fabricamaquete.onrender.com/ws/campo');
});

// Guardar conexões ativas por MAC Address do ESP32
const espClients = new Map(); // MAC -> WebSocket Connection
const espMatches = new Map();  // MAC -> matchId (jogo ativo monitorado)
const activeChannels = new Map(); // matchId -> Supabase Realtime Channel

// Traduz o evento do banco de dados para a vibração configurada no ESP32
function mapearEventoParaVibracao(evento) {
  if (!evento) return "toque";
  const ev = evento.toLowerCase();
  if (ev === "goal" || ev === "gol") return "gol";
  if (ev === "shot" || ev === "post" || ev === "chute") return "chute";
  if (ev === "throw-in" || ev === "corner" || ev === "lateral" || ev === "foul" || ev === "escanteio") return "lateral";
  if (ev === "kick" || ev === "goalkick" || ev === "tiro_de_meta") return "tiro_de_meta";
  return "toque";
}

// Transmitir coordenadas para uma maquete específica por MAC
function transmitirParaMaquete(mac, x, y, evento) {
  const ws = espClients.get(mac);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const isHaptic = (evento !== 'normal' && evento !== 'normal_possession' && evento !== '');
  const tipoVib_mecanica = mapearEventoParaVibracao(evento);

  const payload = JSON.stringify({
    x: parseFloat(x),
    y: parseFloat(y),
    haptic: isHaptic,
    type: tipoVib_mecanica
  });

  console.log(`[Ponte -> ESP32] Enviando para MAC ${mac} -> X: ${x}%, Y: ${y}% (Vibrar: ${isHaptic} [${tipoVib_mecanica}])`);
  ws.send(payload);
}

// Inscreve no Supabase Realtime para um jogo específico
function assinarCanalDoJogo(matchId) {
  if (activeChannels.has(matchId)) return;

  console.log(`📡 Criando canal Realtime para a partida: ${matchId}`);
  const channel = supabase
    .channel(`match-live-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'match_live_states',
        filter: `match_id=eq.${matchId}`
      },
      (payload) => {
        if (!payload.new) return;
        const data = payload.new;
        
        // Transmite a nova coordenada para todas as maquetes que estão assistindo este jogo
        for (const [mac, mId] of espMatches.entries()) {
          if (mId === matchId) {
            transmitirParaMaquete(mac, data.ball_x, data.ball_y, data.last_event);
          }
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime Jogo] Canal ${matchId} estado: ${status}`);
    });

  activeChannels.set(matchId, channel);
}

// Monitora alterações na tabela de maquetes para saber quando um usuário trocou de jogo
console.log('📡 Assinando tabela maquete_status para monitorar seleções de jogos...');
supabase
  .channel('maquete-status-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'maquete_status'
    },
    (payload) => {
      if (!payload.new) return;
      const data = payload.new;
      const mac = data.mac_address;
      const newMatchId = data.current_match_id;

      if (espClients.has(mac)) {
        console.log(`[Pareamento] Maquete MAC ${mac} trocou de jogo para: ${newMatchId}`);
        espMatches.set(mac, newMatchId);
        if (newMatchId) {
          assinarCanalDoJogo(newMatchId);
        }
      }
    }
  )
  .subscribe();

wss.on('connection', async (ws, req) => {
  console.log(`[WebSocket] Nova conexão recebida de: ${req.socket.remoteAddress}`);
  let clientMac = null;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      
      // 1. EVENTO DE REGISTRO DO ESP32
      if (msg.event === 'register') {
        clientMac = msg.mac;
        console.log(`🚀 Dispositivo registrado com sucesso! MAC/ID: ${clientMac}`);
        if (clientMac && clientMac !== 'web_admin') {
          espClients.set(clientMac, ws);
          // Atualiza status no Supabase
          await supabase.from('maquete_status').upsert({
            mac_address: clientMac,
            battery_level: 100,
            updated_at: new Date().toISOString()
          });
        }
      }

      // 2. EVENTO DE BATERIA OU HEARTBEAT RECEBIDO DO ESP32
      if (msg.event === 'battery' || msg.event === 'heartbeat') {
        if (msg.mac && msg.mac !== 'web_admin') {
          const bat = msg.battery || msg.value || 100;
          await supabase
            .from('maquete_status')
            .upsert({
              mac_address: msg.mac,
              battery_level: parseInt(bat),
              updated_at: new Date().toISOString()
            });
        }
      }

      // 3. EVENTO DE TOQUE FÍSICO
      if (msg.event === 'touch') {
        console.log(`💥 Interação tátil no botão da maquete MAC ${clientMac}!`);
        const activeMatch = espMatches.get(clientMac) || 'af_mock_sincronizacao';
        
        await supabase
          .from('match_live_states')
          .update({ 
            last_event: 'touch',
            event_desc: 'Interação tátil confirmada! Usuário encontrou a bola.',
            updated_at: new Date().toISOString()
          })
          .eq('match_id', activeMatch);
      }

      // 4. RETRANSMISSÃO (BROADCAST RELAY) DE MENSAGENS PARA OS OUTROS CLIENTES (WEB ADMIN / OUTROS)
      for (const client of wss.clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(msg));
        }
      }

    } catch (err) {
      console.error('[WebSocket] Erro ao processar mensagem:', err.message);
    }
  });

  ws.on('close', () => {
    if (clientMac) {
      console.log(`[WebSocket] Conexão encerrada pelo MAC: ${clientMac}`);
      espClients.delete(clientMac);
    }
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Erro no cliente:', err.message);
    if (clientMac) espClients.delete(clientMac);
  });
});

process.on('SIGINT', () => {
  console.log('\nEncerrando servidor ponte...');
  wss.close();
  process.exit();
});
