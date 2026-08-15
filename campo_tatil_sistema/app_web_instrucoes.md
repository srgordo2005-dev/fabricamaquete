# Manual de Integração e Operação - Campo Tátil Pro

Este diretório contém toda a lógica integrada da **Fábrica de Maquetes do Campo Tátil Pro**. Abaixo está o guia passo a passo de como os componentes se comunicam, como rodar, compilar e utilizar os recursos de acessibilidade.

---

## 🔌 Especificação da Pinagem do ESP32 (30 pinos)

Abaixo está o circuito elétrico recomendado de conexão da placa ESP32 com os drivers de motor silenciosos **TMC2208** e sensores:

```
                  +--------------------------------+
                  |            ESP32               |
                  |                                |
                  |  GPIO 14 (D14)  ---> X_STEP    |
                  |  GPIO 27 (D27)  ---> X_DIR     |
                  |  GPIO 12 (D12)  ---> Y_STEP    |
                  |  GPIO 13 (D13)  ---> Y_DIR     |
                  |                                |
                  |  GPIO 32 (D32)  <--- Endstop X |
                  |  GPIO 33 (D33)  <--- Endstop Y |
                  |  GPIO 4  (D4)   <--- Botão AP  | (Segurar por 3s para resetar Wi-Fi)
                  |  GPIO 25 (D25)  ---> Vibrador  | (Háptico campo)
                  |                                |
                  |  GND            ---> GND Comum |
                  |  5V / VIN       ---> Fonte 5V  |
                  +--------------------------------+
```

---

## 📶 Como Configurar o Wi-Fi da Maquete (Captive Portal)

A maquete possui gerenciamento inteligente de rede Wi-Fi que dispensa codificar a senha direto no código:

1. Ao ligar a maquete pela primeira vez ou se ela não achar sua rede, ela criará um ponto de acesso Wi-Fi próprio chamado **`CampoTatil_Config`**.
2. O vibrador da maquete emitirá pequenos pulsos contínuos indicando que está em modo de configuração.
3. No seu celular ou computador, conecte no Wi-Fi **`CampoTatil_Config`**.
4. Uma página de configuração abrirá automaticamente (se não abrir, acesse: **`http://192.168.4.1`**).
5. Digite o **nome da sua rede Wi-Fi**, a **senha** e o **IP do Computador** que rodará o servidor ponte local.
6. Clique em **Salvar e Conectar**. A maquete vai reiniciar e se conectar à rede da sua casa automaticamente!

---

## 🖥️ Como Rodar e Compilar o Servidor Ponte

O servidor ponte atua como o elo de ligação entre a nuvem (Supabase) e a sua rede local (ESP32).

### Opção A: Rodando em Desenvolvimento (Node.js)
1. Certifique-se de que você tem o Node.js instalado.
2. Dê dois cliques no arquivo **[`iniciar_ponte.bat`](file:///c:/Users/Felip/OneDrive/Documentos/ATY%20HUB%20BET/campo_tatil_sistema/servidor_ponte/iniciar_ponte.bat)**.
3. Ele vai instalar as bibliotecas necessárias e iniciar a ponte na porta `8080`.

### Opção B: Gerando um Executável `.exe` Independente (Fábrica de Maquetes)
1. Dê dois cliques no arquivo **[`compilar_executavel.bat`](file:///c:/Users/Felip/OneDrive/Documentos/ATY%20HUB%20BET/campo_tatil_sistema/servidor_ponte/compilar_executavel.bat)**.
2. Ele usará o utilitário `pkg` para criar o arquivo **`campo-tatil-ponte.exe`**.
3. Agora você pode copiar esse arquivo `.exe` e o arquivo `.env` para qualquer computador Windows. Ele rodará com dois cliques sem precisar ter o Node.js instalado!

---

## 🎓 Modo Apresentação: Aprendendo a Geografia do Campo

A rotina de apresentação é focada em acessibilidade educacional, ajudando o deficiente visual a conhecer o relevo do campo físico antes da partida começar:

1. No aplicativo Web ou painel Admin, clique no botão **Apresentar Campo** (ou envie `{"mode": "presentation"}` para o WebSocket).
2. O ímã na maquete começará a navegar de forma independente pelas zonas marcadas da maquete (Centro, Gol Esquerdo, Gol Direito, Escanteios).
3. A cada zona que o ímã chega, a maquete envia uma mensagem de volta para o aplicativo celular:
   ```json
   { "status": "presentation", "desc": "Gol do time da esquerda...", "step": 1 }
   ```
4. O celular recebe este aviso em tempo real e narra com a voz do sintetizador: *"O ímã se moveu para o Gol da Esquerda. Esta área possui um degrau em baixo relevo..."*.

---

## ♿ Lógica de Acessibilidade Sonora no Celular (Plano Slim)

Para que a maquete no plano Slim seja barata e acessível, o processamento de áudio fica a cargo do celular do usuário (via navegador/app):

1. **Leitores de Tela (Acessibilidade Nativa)**:
   Renderizamos uma div invisível com o atributo `aria-live="assertive"`:
   ```html
   <div aria-live="assertive" class="sr-only">
       {announcement}
   </div>
   ```
   Sempre que a coordenada da bola muda de quadrante ou sai um lance importante (como gol/falta), o React atualiza o estado `announcement`. O TalkBack (Android) ou VoiceOver (iOS) detectam a mudança e leem o texto automaticamente para o usuário.

2. **Narração por Voz Sintetizada Nativa**:
   Usamos a API **`window.speechSynthesis`** do JavaScript para ler descrições fluidas do jogo mesmo que o usuário não use o TalkBack ativo:
   ```javascript
   const speak = (text) => {
     window.speechSynthesis.cancel(); // Para fala anterior imediatamente
     const utterance = new SpeechSynthesisUtterance(text);
     utterance.lang = "pt-BR";
     utterance.rate = 1.1; // Velocidade levemente acelerada para partidas dinâmicas
     window.speechSynthesis.speak(utterance);
   };
   ```
