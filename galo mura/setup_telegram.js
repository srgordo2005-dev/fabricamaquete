const fs = require('fs');
const path = require('path');

const token = '8785080402:AAE7olIpOtHXhmrLWFHzSX2gZTUhPHFoKEY';
const SERVER_PATH = path.join(__dirname, 'server.js');

console.log('====================================================');
console.log('       ASSISTENTE DE CONFIGURACAO DO TELEGRAM       ');
console.log('====================================================');
console.log('\nPasso 1: Abra o Telegram e envie uma mensagem para: @macplumabot');
console.log('Aguardando envio da mensagem...');

let interval = setInterval(async () => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();
    
    if (data.ok && data.result && data.result.length > 0) {
      const lastUpdate = data.result[data.result.length - 1];
      const message = lastUpdate.message || lastUpdate.edited_message;
      
      if (message && message.chat) {
        const chatId = message.chat.id;
        const userName = message.from.first_name || 'Usuario';
        
        console.log(`\n🎉 SINAL DETECTADO!`);
        console.log(`Nome: ${userName}`);
        console.log(`Chat ID: ${chatId}`);
        
        // Save Chat ID to server.js
        if (fs.existsSync(SERVER_PATH)) {
          let serverContent = fs.readFileSync(SERVER_PATH, 'utf8');
          serverContent = serverContent.replace(
            /const TELEGRAM_CHAT_ID = '.*';/g,
            `const TELEGRAM_CHAT_ID = '${chatId}';`
          );
          fs.writeFileSync(SERVER_PATH, serverContent);
          console.log('✅ Chat ID gravado com sucesso no arquivo server.js!');
        }
        
        // Send a test message back to the user
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '✅ *Conexão Confirmada!*\nSeu celular foi cadastrado com sucesso no app Galo Mura.',
            parse_mode: 'Markdown'
          })
        });
        console.log('✉️ Mensagem de teste enviada para seu Telegram.');
        
        clearInterval(interval);
        process.exit(0);
      }
    }
  } catch (err) {
    console.error('Erro de conexao:', err.message);
  }
}, 2000);
