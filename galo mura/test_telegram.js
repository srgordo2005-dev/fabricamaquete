const token = '8785080402:AAE7olIpOtHXhmrLWFHzSX2gZTUhPHFoKEY';
console.log('Testando token:', token);
fetch(`https://api.telegram.org/bot${token}/getUpdates`)
  .then(res => res.json())
  .then(json => {
    console.log('Resultado da API do Telegram:');
    console.log(JSON.stringify(json, null, 2));
  })
  .catch(err => {
    console.error('Erro de conexao:', err);
  });
