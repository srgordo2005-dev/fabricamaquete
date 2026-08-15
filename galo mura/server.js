const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));

// Set base path for portable executables (pkg compatibility)
// Static frontend files (html, css, js) are bundled INSIDE the executable snapshot
const staticPath = __dirname;

// Database (db.json) is kept OUTSIDE in the same folder as the executable on the USB drive
const externalPath = process.pkg ? path.dirname(process.execPath) : __dirname;

app.use(express.static(path.join(staticPath, 'public')));

const DB_PATH = path.join(externalPath, 'db.json');
const UPLOADS_DIR = path.join(externalPath, 'public', 'uploads');

// Ensure database and upload folders exist
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ roosters: [], sponsors: [], activeFight: null, history: [], queue: [] }, null, 2));
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configurações de Licenciamento e Proteção
const ALLOWED_MACS = [
  '*' // Mude para o MAC do seu computador (ex: '00:a5:54:57:41:44') para bloquear outras máquinas
];

// Configurações do Telegram
const TELEGRAM_TOKEN = '8785080402:AAE7olIpOtHXhmrLWFHzSX2gZTUhPHFoKEY';
const TELEGRAM_CHAT_ID = '5651208708'; // Deixe vazio para detectar automaticamente quem mandou mensagem pro bot 

// Helper to get local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Helper to get MAC addresses of the computer
function getMacAddresses() {
  const macs = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
        macs.push(iface.mac.toLowerCase());
      }
    }
  }
  return macs;
}

// Validate license
const myMacs = getMacAddresses();
const isAuthorized = ALLOWED_MACS.includes('*') || myMacs.some(mac => ALLOWED_MACS.map(m => m.toLowerCase()).includes(mac));

if (!isAuthorized) {
  console.error('\n======================================================');
  console.error('❌ ERRO: Computador nao autorizado a rodar este app.');
  console.error('MACs detectados:', myMacs.join(' | '));
  console.error('======================================================\n');
  process.exit(1); // Shuts down the server
}

// Send startup notification to Telegram
async function notifyTelegram() {
  try {
    let chatId = TELEGRAM_CHAT_ID;
    if (!chatId) {
      // Tenta obter o último chat_id que interagiu com o bot
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`);
      const data = await response.json();
      if (data.ok && data.result && data.result.length > 0) {
        const lastMessage = data.result[data.result.length - 1].message;
        if (lastMessage && lastMessage.chat) {
          chatId = lastMessage.chat.id;
        }
      }
    }

    if (chatId) {
      const msgText = `🔔 *Galo Mura App Iniciado!*\n🖥️ *MACs:* ${myMacs.join(' | ')}\n🌐 *IP Local:* ${getLocalIpAddress()}`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: msgText,
          parse_mode: 'Markdown'
        })
      });
      console.log(`[Telegram] Notificação de inicialização enviada para o Chat ID: ${chatId}`);
    } else {
      console.log('[Telegram] Nenhum Chat ID encontrado. Inicie uma conversa com o bot enviando uma mensagem (ex: /start) e reinicie o servidor.');
    }
  } catch (err) {
    console.log('[Telegram] Erro ao enviar notificação:', err.message);
  }
}
notifyTelegram();

// API Routes
app.get('/api/data', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!data.queue) data.queue = [];
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler banco de dados' });
  }
});

app.post('/api/data', (req, res) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar dados' });
  }
});

// API endpoint for uploading sponsor logo (accepts base64)
app.post('/api/upload-logo', (req, res) => {
  try {
    const { name, base64Data } = req.body;
    if (!name || !base64Data) {
      return res.status(400).json({ error: 'Nome e imagem são obrigatórios' });
    }

    // Extract file extension and actual base64 content
    const matches = base64Data.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Formato de imagem inválido' });
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    const filename = `logo_${Date.now()}.${extension}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    
    fs.writeFileSync(filepath, imageBuffer);
    
    // Add to database
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const newSponsor = {
      id: Date.now().toString(),
      name: name,
      logo: `/uploads/${filename}`
    };
    db.sponsors.push(newSponsor);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

    res.json({ success: true, sponsor: newSponsor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
  }
});

app.get('/api/ip', (req, res) => {
  res.json({ ip: getLocalIpAddress(), port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`Servidor rodando localmente.`);
  console.log(`Para a TV (Computador): http://localhost:${PORT}`);
  console.log(`Para o Celular (Admin): http://${getLocalIpAddress()}:${PORT}/admin.html`);
  console.log(`MACs detectados nesta maquina: ${getMacAddresses().join(' | ')}`);
  console.log(`======================================================\n`);
});
