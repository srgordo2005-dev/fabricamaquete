/* ==========================================================================
   SERVIDO DE INTEGRAÇÃO - PONTE SUPABASE -> WEBSOCKET ESP32
   Este servidor escuta as coordenadas em tempo real no Supabase (Nuvem)
   e as repassa imediatamente para o ESP32 (Local) via WebSockets.
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

// Fallback caso não leia o arquivo por algum motivo (ajuste se necessário)
supabaseUrl = supabaseUrl || "https://gzakagtzfflwwoprystv.supabase.co";
supabaseKey = supabaseKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

console.log('----------------------------------------------------');
console.log('🔌 Conectando ao Supabase:', supabaseUrl);
console.log('----------------------------------------------------');

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. INICIAR SERVIDOR WEBSOCKET LOCAL (Porta 8080)
const wss = new WebSocket.Server({ port: 8080 }, () => {
  console.log('🚀 Servidor Ponte WebSocket rodando na porta 8080');
  console.log('👉 Endereço para o ESP32 se conectar: ws://[IP_DESTE_PC]:8080/ws/campo');
});

// Guardar conexões ativas do ESP32
const espClients = new Set();
let ultimaCoordenada = { x: 50.0, y: 50.0, haptic: false, pulse_ms: 200 };

wss.on('connection', async (ws, req) => {
  console.log(`[WebSocket] Nova conexão estabelecida de: ${req.socket.remoteAddress}`);
  espClients.add(ws);

  // Enviar a última coordenada conhecida imediatamente para alinhar a maquete física
  ws.send(JSON.stringify(ultimaCoordenada));

  ws.on('close', () => {
    console.log('[WebSocket] Conexão encerrada pelo cliente.');
    espClients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Erro no cliente:', err.message);
    espClients.delete(ws);
  });
});

// Função para transmitir dados para todos os ESP32 conectados
function transmitirParaESP32(x, y, evento = 'normal') {
  const isHaptic = (evento !== 'normal' && evento !== '');
  let pulse = 200;
  if (evento === 'goal') pulse = 500;
  if (evento === 'foul') pulse = 350;

  ultimaCoordenada = {
    x: parseFloat(x),
    y: parseFloat(y),
    haptic: isHaptic,
    pulse_ms: pulse
  };

  const payload = JSON.stringify(ultimaCoordenada);
  console.log(`[Ponte] Enviando para ${espClients.size} ESP32s -> X: ${x}%, Y: ${y}% (Evento: ${evento})`);

  for (const client of espClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// 3. INSCREVER NAS MUDANÇAS DO BANCO DE DADOS (SUPABASE REALTIME)
console.log('📡 Assinando canal de atualizações em tempo real do Supabase...');

const canalRealtime = supabase
  .channel('live-ball-coordinates')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'match_live_states'
    },
    (payload) => {
      console.log('[Realtime] Novo jogo iniciado!');
      const data = payload.new;
      transmitirParaESP32(data.ball_x, data.ball_y, data.last_event);
    }
  )
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'match_live_states'
    },
    (payload) => {
      const data = payload.new;
      transmitirParaESP32(data.ball_x, data.ball_y, data.last_event);
    }
  )
  .subscribe((status) => {
    console.log('[Realtime] Estado da conexão Supabase:', status);
    if (status === 'SUBSCRIBED') {
      console.log('🟢 Sucesso! O servidor ponte está ativo e escutando mudanças do banco.');
    }
  });

// Tratamento de interrupção para fechar conexões limpas
process.on('SIGINT', () => {
  console.log('\nEncerrando servidor ponte...');
  wss.close();
  process.exit();
});
