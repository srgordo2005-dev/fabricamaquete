/* ==========================================================================
   SERVIDO DE INTEGRAÇÃO - PONTE SUPABASE -> WEBSOCKET ESP32
   Este servidor escuta as coordenadas em tempo real no Supabase (Nuvem)
   e as repassa imediatamente para o ESP32 (Local) via WebSockets.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

// 1. CARREGAR VARIÁVEIS DE AMBIENTE (.env)
// Verifica a pasta atual do processo (funciona quando compilado para .exe) ou a pasta mãe
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', 'BetSmarterHub_extracted', '.env')
];

let supabaseUrl = '';
let supabaseKey = '';

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`[Config] Carregando variáveis de ambiente de: ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const matchUrl = line.match(/^\s*SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
      const matchKey = line.match(/^\s*SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\s]+)["']?/);
      if (matchUrl) supabaseUrl = matchUrl[1];
      if (matchKey) supabaseKey = matchKey[1];
    }
    if (supabaseUrl && supabaseKey) break;
  }
}

// Fallback padrão se não ler o .env
supabaseUrl = supabaseUrl || "https://gzakagtzfflwwoprystv.supabase.co";
supabaseKey = supabaseKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

console.log('----------------------------------------------------');
console.log('🔌 Conectando ao Supabase:', supabaseUrl);
console.log('----------------------------------------------------');

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. INICIAR SERVIDOR WEBSOCKET LOCAL (Porta 8080)
const wss = new WebSocket.Server({ port: 8080 }, () => {
  console.log('🚀 Servidor Ponte WebSocket rodando na porta 8080');
  console.log('👉 Conecte o ESP32 na porta 8080 da sua rede.');
});

// Guardar conexões ativas do ESP32
const espClients = new Set();
let ultimaCoordenada = { x: 50.0, y: 50.0, haptic: false, pulse_ms: 200 };

wss.on('connection', async (ws, req) => {
  console.log(`[WebSocket] ESP32 Conectado de: ${req.socket.remoteAddress}`);
  espClients.add(ws);

  // Envia a última coordenada salva para alinhar a maquete imediatamente
  ws.send(JSON.stringify(ultimaCoordenada));

  ws.on('message', (message) => {
    // Trata retornos da maquete (ex: status da apresentação)
    try {
      const data = JSON.parse(message);
      if (data.status === 'presentation') {
        console.log(`[Apresentação] Maquete está na etapa ${data.step}: ${data.desc}`);
        // Repassa para qualquer cliente (Web App) conectado no WebSocket
        broadcastToClients(message.toString());
      }
    } catch(e) {}
  });

  ws.on('close', () => {
    console.log('[WebSocket] ESP32 desconectou.');
    espClients.delete(ws);
  });

  ws.on('error', (err) => {
    espClients.delete(ws);
  });
});

// Função para enviar para todos os clientes
function broadcastToClients(dataStr) {
  for (const client of espClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(dataStr);
    }
  }
}

// Transmitir dados para o ESP32
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
  console.log(`[Ponte] Transmitindo -> X: ${x}%, Y: ${y}% (Evento: ${evento})`);
  broadcastToClients(payload);
}

// 3. INSCREVER NAS MUDANÇAS EM TEMPO REAL DO SUPABASE
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
    console.log('[Supabase Realtime] Canal:', status);
    if (status === 'SUBSCRIBED') {
      console.log('🟢 Sucesso! O servidor ponte está conectado à nuvem.');
    }
  });

process.on('SIGINT', () => {
  console.log('\nEncerrando servidor...');
  wss.close();
  process.exit();
});
