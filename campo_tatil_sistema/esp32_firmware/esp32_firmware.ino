/* ==========================================================================
   PROJETO CAMPO TÁTIL PRO - FIRMWARE ESP32
   Motores NEMA 14 | Drivers TMC2208 | WiFi Manager Cativo | Modo Apresentação
   ========================================================================== */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <AccelStepper.h>

// ==========================================================================
// CONFIGURAÇÕES MECÂNICAS & PINAGEM (ESP32 30-PIN)
// ==========================================================================
const float CURSO_UTIL_X_MM = 160.0;
const float CURSO_UTIL_Y_MM = 320.0;
const float PASSOS_POR_MM_X = 80.0;
const float PASSOS_POR_MM_Y = 80.0;

const long LIMITE_PASSOS_X = CURSO_UTIL_X_MM * PASSOS_POR_MM_X;
const long LIMITE_PASSOS_Y = CURSO_UTIL_Y_MM * PASSOS_POR_MM_Y;

#define PIN_X_STEP 14
#define PIN_X_DIR  27
#define PIN_X_ENDSTOP 32

#define PIN_Y_STEP 12
#define PIN_Y_DIR  13
#define PIN_Y_ENDSTOP 33

#define PIN_CONFIG_BUTTON 4  // Botão para resetar Wi-Fi
#define PIN_HAPTIC 25        // Vibrador háptico

AccelStepper stepperX(AccelStepper::DRIVER, PIN_X_STEP, PIN_X_DIR);
AccelStepper stepperY(AccelStepper::DRIVER, PIN_Y_STEP, PIN_Y_DIR);

// Instâncias de Serviços
Preferences preferences;
WebServer server(80);
DNSServer dnsServer;
WebSocketsClient webSocket;

// Estado do Wi-Fi e Conexão
String wifi_ssid = "";
String wifi_pass = "";
String server_ip = "192.168.1.100";
bool apMode = false;

// Estado da Apresentação
bool emApresentacao = false;
int etapaApresentacao = 0;
unsigned long tempoEtapa = 0;

// Coordenadas da Apresentação (X%, Y%, Descrição do Setor)
struct PontoApresentacao {
  float x; float y; const char* desc;
};
PontoApresentacao pontosApresentacao[] = {
  {50, 50, "Bola no centro do campo. Ponto de início de jogo."},
  {2, 50,  "Gol do time da esquerda. Linha de fundo delimitada por barreira física."},
  {98, 50, "Gol do time da direita. Linha de fundo delimitada por barreira física."},
  {2, 2,   "Escanteio superior esquerdo."},
  {2, 98,  "Escanteio inferior esquerdo."},
  {98, 2,  "Escanteio superior direito."},
  {98, 98, "Escanteio inferior direito."},
  {50, 50, "Retornando ao centro do campo. Apresentação concluída."}
};
const int totalPontosApresentacao = 8;

// ==========================================================================
// FUNÇÕES DE MOVIMENTO E CALIBRAÇÃO (HOMING)
// ==========================================================================
void executarHoming() {
  Serial.println("\n[Homing] Iniciando calibração mecânica...");
  
  stepperX.setMaxSpeed(1000.0);
  stepperX.setAcceleration(500.0);
  stepperX.setSpeed(-800.0);
  while (digitalRead(PIN_X_ENDSTOP) == HIGH) { 
    stepperX.runSpeed();
    delayMicroseconds(5);
  }
  stepperX.setCurrentPosition(0);
  stepperX.setSpeed(0);
  
  // Afasta X
  stepperX.moveTo(5.0 * PASSOS_POR_MM_X);
  while (stepperX.distanceToGo() != 0) stepperX.run();
  
  stepperY.setMaxSpeed(1000.0);
  stepperY.setAcceleration(500.0);
  stepperY.setSpeed(-800.0);
  while (digitalRead(PIN_Y_ENDSTOP) == HIGH) {
    stepperY.runSpeed();
    delayMicroseconds(5);
  }
  stepperY.setCurrentPosition(0);
  stepperY.setSpeed(0);
  
  // Afasta Y
  stepperY.moveTo(5.0 * PASSOS_POR_MM_Y);
  while (stepperY.distanceToGo() != 0) stepperY.run();

  // Velocidades normais de jogo
  stepperX.setMaxSpeed(3500.0);
  stepperX.setAcceleration(4500.0);
  stepperY.setMaxSpeed(3500.0);
  stepperY.setAcceleration(4500.0);

  // Ir para o centro
  stepperX.moveTo(LIMITE_PASSOS_X / 2);
  stepperY.moveTo(LIMITE_PASSOS_Y / 2);
  while (stepperX.distanceToGo() != 0 || stepperY.distanceToGo() != 0) {
    stepperX.run();
    stepperY.run();
  }
  Serial.println("[Homing] Calibração concluída! Posição centralizada.");
}

// ==========================================================================
// MÓDULO WI-FI MANAGER (PORTAL CATIVO AP)
// ==========================================================================
void handleConfigSave() {
  if (server.hasArg("ssid") && server.hasArg("pass") && server.hasArg("ip")) {
    wifi_ssid = server.arg("ssid");
    wifi_pass = server.arg("pass");
    server_ip = server.arg("ip");

    preferences.begin("wifi-config", false);
    preferences.putString("ssid", wifi_ssid);
    preferences.putString("pass", wifi_pass);
    preferences.putString("ip", server_ip);
    preferences.end();

    String html = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>";
    html += "<style>body{font-family:sans-serif;background:#0d1117;color:#fff;text-align:center;padding:40px;}h1{color:#00ff87;}</style></head>";
    html += "<body><h1>Configurações Salvas!</h1><p>A maquete vai reiniciar e tentar se conectar à rede <b>" + wifi_ssid + "</b>.</p>";
    html += "<p>Você pode fechar esta página.</p></body></html>";
    server.send(200, "text/html", html);

    delay(2000);
    ESP.restart();
  } else {
    server.send(400, "text/plain", "Parâmetros inválidos");
  }
}

void setupCaptivePortal() {
  apMode = true;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("CampoTatil_Config");
  
  // IP padrão do Portal Cativo
  IPAddress apIP(192, 168, 4, 1);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));

  dnsServer.start(53, "*", apIP);

  // Página do Portal Cativo Acessível
  server.on("/", HTTP_GET, []() {
    String html = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>";
    html += "<title>Fábrica de Maquetes - Configuração</title>";
    html += "<style>";
    html += "body{font-family:sans-serif;background:#0d1117;color:#c9d1d9;padding:20px;margin:0;}";
    html += ".container{max-width:400px;margin:30px auto;background:#161b22;padding:20px;border-radius:8px;border:1px solid #30363d;}";
    html += "h1{color:#00ff87;text-align:center;font-size:24px;}";
    html += "label{display:block;margin:15px 0 5px;font-weight:bold;font-size:14px;}";
    html += "input{width:100%;padding:10px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#fff;box-sizing:border-box;}";
    html += "button{width:100%;padding:12px;margin-top:25px;background:#00ff87;color:#0d1117;border:none;font-weight:bold;font-size:16px;border-radius:4px;cursor:pointer;}";
    html += "button:hover{background:#00e575;}";
    html += "</style></head><body><div class='container'>";
    html += "<h1>Campo Tátil Pro</h1>";
    html += "<p style='text-align:center;font-size:12px;color:#8b949e;'>Insira os dados de conexão da sua residência.</p>";
    html += "<form action='/save' method='POST'>";
    html += "<label for='ssid'>Nome do Wi-Fi (SSID)</label>";
    html += "<input type='text' id='ssid' name='ssid' required placeholder='Ex: MinhaRede_2G'>";
    html += "<label for='pass'>Senha do Wi-Fi</label>";
    html += "<input type='password' id='pass' name='pass' required placeholder='Sua senha do Wi-Fi'>";
    html += "<label for='ip'>IP do Computador Servidor</label>";
    html += "<input type='text' id='ip' name='ip' required value='" + server_ip + "' placeholder='Ex: 192.168.1.100'>";
    html += "<button type='submit'>Salvar e Conectar Maquete</button>";
    html += "</form></div></body></html>";
    server.send(200, "text/html", html);
  });

  server.on("/save", HTTP_POST, handleConfigSave);
  
  // Redireciona tudo para o IP do AP
  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1/", true);
    server.send(302, "text/plain", "");
  });

  server.begin();
  Serial.println("\n[AP Mode] Rede 'CampoTatil_Config' criada.");
  Serial.println("[AP Mode] Acesse: http://192.168.4.1 no seu navegador para configurar.");
}

// ==========================================================================
// TRATAMENTO DO MODO APRESENTAÇÃO
// ==========================================================================
void iniciarApresentacao() {
  emApresentacao = true;
  etapaApresentacao = 0;
  tempoEtapa = millis();
  Serial.println("[Apresentação] Iniciada rotina de demonstração.");
}

void processarApresentacao() {
  if (!emApresentacao) return;

  if (millis() - tempoEtapa > 4000) { // 4 segundos em cada ponto
    if (etapaApresentacao < totalPontosApresentacao) {
      PontoApresentacao p = pontosApresentacao[etapaApresentacao];
      
      long targetX = (p.x / 100.0) * LIMITE_PASSOS_X;
      long targetY = (p.y / 100.0) * LIMITE_PASSOS_Y;
      
      stepperX.moveTo(targetX);
      stepperY.moveTo(targetY);

      // Envia notificação de voz de volta para o Web App narrar
      StaticJsonDocument<256> doc;
      doc["status"] = "presentation";
      doc["desc"] = p.desc;
      doc["step"] = etapaApresentacao;
      char buffer[256];
      serializeJson(doc, buffer);
      webSocket.sendTXT(buffer);

      Serial.printf("[Apresentação] Etapa %d -> %s\n", etapaApresentacao, p.desc);
      
      etapaApresentacao++;
      tempoEtapa = millis();
    } else {
      emApresentacao = false;
      Serial.println("[Apresentação] Fim da rotina.");
    }
  }
}

// ==========================================================================
// RECEBIMENTO DE COMANDOS VIA WEBSOCKET (JSON)
// ==========================================================================
void tratarMensagemWS(uint8_t * payload, size_t length) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) return;

  // Comando de Apresentação
  if (doc.containsKey("mode") && doc["mode"] == "presentation") {
    iniciarApresentacao();
    return;
  }

  // Se receber coordenadas e NÃO estiver rodando apresentação autónoma
  if (!emApresentacao && doc.containsKey("x") && doc.containsKey("y")) {
    float x_pct = doc["x"];
    float y_pct = doc["y"];
    
    x_pct = constrain(x_pct, 0.0, 100.0);
    y_pct = constrain(y_pct, 0.0, 100.0);
    
    long targetX = (x_pct / 100.0) * LIMITE_PASSOS_X;
    long targetY = (y_pct / 100.0) * LIMITE_PASSOS_Y;
    
    stepperX.moveTo(targetX);
    stepperY.moveTo(targetY);
  }

  // Vibração
  if (doc.containsKey("haptic") && doc["haptic"] == true) {
    int duration = doc.containsKey("pulse_ms") ? doc["pulse_ms"] : 200;
    digitalWrite(PIN_HAPTIC, HIGH);
    delay(duration);
    digitalWrite(PIN_HAPTIC, LOW);
  }
}

void eventoWebSocket(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Desconectado!");
      break;
    case WStype_CONNECTED:
      Serial.println("[WS] Conectado ao servidor de integração!");
      // Avisa que a maquete conectou
      webSocket.sendTXT("{\"status\":\"maquete_connected\"}");
      break;
    case WStype_TEXT:
      tratarMensagemWS(payload, length);
      break;
    default:
      break;
  }
}

// ==========================================================================
// SETUP & LOOP PRINCIPAL DO ARDUINO
// ==========================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(PIN_X_ENDSTOP, INPUT_PULLUP);
  pinMode(PIN_Y_ENDSTOP, INPUT_PULLUP);
  pinMode(PIN_CONFIG_BUTTON, INPUT_PULLUP);
  pinMode(PIN_HAPTIC, OUTPUT);
  digitalWrite(PIN_HAPTIC, LOW);

  // 1. LER CONFIGURAÇÕES DA MEMÓRIA
  preferences.begin("wifi-config", true);
  wifi_ssid = preferences.getString("ssid", "");
  wifi_pass = preferences.getString("pass", "");
  server_ip = preferences.getString("ip", "192.168.1.100");
  preferences.end();

  // Se o botão de reset de Wi-Fi estiver pressionado ao ligar, força portal AP
  if (digitalRead(PIN_CONFIG_BUTTON) == LOW || wifi_ssid == "") {
    setupCaptivePortal();
    return;
  }

  // 2. CONECTAR WI-FI
  WiFi.begin(wifi_ssid.c_str(), wifi_pass.c_str());
  int t = 0;
  Serial.printf("Tentando conectar a rede: %s ", wifi_ssid.c_str());
  while (WiFi.status() != WL_CONNECTED && t < 30) { // 15 segundos timeout
    delay(500);
    Serial.print(".");
    t++;
  }

  // Se falhar a conexão, abre o Portal Cativo de Configuração
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[WiFi] Falha de conexão. Iniciando Portal de Configuração...");
    setupCaptivePortal();
    return;
  }

  Serial.printf("\n[WiFi] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());

  // 3. CALIBRAÇÃO FÍSICA E INICIALIZAÇÃO WEBSOCKET
  executarHoming();
  
  webSocket.begin(server_ip.c_str(), 8080, "/ws/campo");
  webSocket.onEvent(eventoWebSocket);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  if (apMode) {
    dnsServer.processNextRequest();
    server.handleClient();
    
    // Animação rápida de piscar o haptic para avisar que está em modo de configuração
    static unsigned long tPiscar = 0;
    if (millis() - tPiscar > 1000) {
      digitalWrite(PIN_HAPTIC, !digitalRead(PIN_HAPTIC));
      tPiscar = millis();
    }
  } else {
    // Escuta comandos
    webSocket.loop();
    
    // Processa apresentação passo a passo
    processarApresentacao();
    
    // Atualiza a posição dos motores de forma fluída e suave
    stepperX.run();
    stepperY.run();

    // Reset de Wi-Fi se pressionado o botão de config por 3 segundos
    if (digitalRead(PIN_CONFIG_BUTTON) == LOW) {
      unsigned long tPressione = millis();
      while (digitalRead(PIN_CONFIG_BUTTON) == LOW) {
        if (millis() - tPressione > 3000) {
          Serial.println("[Reset] Botão pressionado por 3s. Apagando Wi-Fi...");
          preferences.begin("wifi-config", false);
          preferences.clear();
          preferences.end();
          ESP.restart();
        }
      }
    }
  }
}
