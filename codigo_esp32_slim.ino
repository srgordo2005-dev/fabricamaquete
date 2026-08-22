/* ==========================================================================
   PROJETO CAMPO TÁTIL / ACESSIVEL.JÁ - FIRMWARE SLIM (ESP32)
   Portal Cativo de Configuração | OLED I2C | Bateria no App | Vibração Háptica 1027
   ========================================================================== */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <AccelStepper.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

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

#define PIN_CONFIG_BUTTON 4  // Botão para resetar Wi-Fi (pressione por 3 segundos)
#define PIN_HAPTIC 25        // Atuador de Vibração Háptica (Motor Moeda 1027)
#define PIN_VIB_SENSOR 15    // Sensor de vibração digital (SW-420)
#define PIN_BATTERY_ADC 34   // Medidor analógico da tensão da bateria (Divisor 10K/10K)

AccelStepper stepperX(AccelStepper::DRIVER, PIN_X_STEP, PIN_X_DIR);
AccelStepper stepperY(AccelStepper::DRIVER, PIN_Y_STEP, PIN_Y_DIR);

Preferences preferences;
WebServer server(80);
DNSServer dnsServer;
WebSocketsClient webSocket;

String wifi_ssid = "";
String wifi_pass = "";
// Servidor fixo embutido no código (oculto do usuário final)
String server_ip = "fabricamaquete.onrender.com";
bool apMode = false;
bool wsConnected = false;

unsigned long ultimoUpdateDisplay = 0;
const unsigned long INTERVALO_DISPLAY_MS = 2000;
unsigned long ultimoEnvioBat = 0;
const unsigned long INTERVALO_BAT_MS = 10000;

// Estado da Apresentação
bool emApresentacao = false;
int etapaApresentacao = 0;
unsigned long tempoEtapa = 0;

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
// FUNÇÕES DE BATERIA E DISPLAY
// ==========================================================================
float lerTensaoBateria() {
  long soma = 0;
  for(int i = 0; i < 15; i++) {
    soma += analogRead(PIN_BATTERY_ADC);
    delay(1);
  }
  float adc_medio = soma / 15.0;
  float tensao_pino = (adc_medio / 4095.0) * 3.3;
  return tensao_pino * 2.0;
}

int calcularPorcentagemBateria(float tensao) {
  if (tensao >= 4.15) return 100;
  if (tensao <= 3.25) return 0;
  return (int)((tensao - 3.25) * 111.1);
}

void atualizarDisplayBateria() {
  float tensao = lerTensaoBateria();
  int pct = calcularPorcentagemBateria(tensao);
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("  ACESSIVEL.JA SLIM");
  display.drawFastHLine(0, 10, 128, SSD1306_WHITE);
  
  display.setCursor(10, 20);
  display.setTextSize(3);
  display.printf("%d%%", pct);
  
  display.setTextSize(1);
  display.setCursor(10, 48);
  display.printf("Tensao: %.2fV", tensao);
  
  display.setCursor(80, 48);
  display.print(wsConnected ? "CONECT" : "DESCON");
  
  display.drawRect(92, 23, 26, 12, SSD1306_WHITE);
  display.fillRect(118, 26, 2, 6, SSD1306_WHITE);
  int larg = (pct * 22) / 100;
  if (larg > 0) {
    display.fillRect(94, 25, larg, 8, SSD1306_WHITE);
  }
  display.display();
}

void enviarEstadoBateria() {
  float tensao = lerTensaoBateria();
  int pct = calcularPorcentagemBateria(tensao);
  
  StaticJsonDocument<256> doc;
  doc["event"] = "battery";
  doc["mac"] = WiFi.macAddress();
  doc["value"] = pct;
  doc["voltage"] = tensao;
  
  char buffer[256];
  serializeJson(doc, buffer);
  webSocket.sendTXT(buffer);
}

// ==========================================================================
// PADRÕES DE VIBRAÇÃO HÁPTICA (MOTOR 1027)
// ==========================================================================
void executarVibracao(String tipo) {
  Serial.printf("[Haptic] Executando vibracao de: %s\n", tipo.c_str());
  if (tipo == "gol") {
    for (int i = 0; i < 3; i++) {
      digitalWrite(PIN_HAPTIC, HIGH); delay(80);
      digitalWrite(PIN_HAPTIC, LOW); delay(80);
    }
    delay(20);
    digitalWrite(PIN_HAPTIC, HIGH); delay(500);
    digitalWrite(PIN_HAPTIC, LOW);
  } else if (tipo == "chute") {
    digitalWrite(PIN_HAPTIC, HIGH); delay(150);
    digitalWrite(PIN_HAPTIC, LOW);
  } else if (tipo == "lateral") {
    digitalWrite(PIN_HAPTIC, HIGH); delay(120);
    digitalWrite(PIN_HAPTIC, LOW); delay(120);
    digitalWrite(PIN_HAPTIC, HIGH); delay(120);
    digitalWrite(PIN_HAPTIC, LOW);
  } else if (tipo == "tiro_de_meta") {
    digitalWrite(PIN_HAPTIC, HIGH); delay(250);
    digitalWrite(PIN_HAPTIC, LOW);
  } else {
    digitalWrite(PIN_HAPTIC, HIGH); delay(60);
    digitalWrite(PIN_HAPTIC, LOW);
  }
}

// ==========================================================================
// FUNÇÕES DE MOVIMENTO E CALIBRAÇÃO (HOMING)
// ==========================================================================
void executarHoming() {
  Serial.println("\n[Homing] Iniciando calibracao mecanica...");
  
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println("Calibrando Maquete...");
  display.println("Mover Eixo X...");
  display.display();

  stepperX.setMaxSpeed(1000.0);
  stepperX.setAcceleration(500.0);
  stepperX.setSpeed(-500.0);
  unsigned long startX = millis();
  bool homedX = false;
  while (digitalRead(PIN_X_ENDSTOP) == HIGH) { 
    if (millis() - startX > 8000) {
      Serial.println("[Homing] Timeout no Eixo X");
      break;
    }
    stepperX.runSpeed();
    delayMicroseconds(5);
    homedX = true;
  }
  if (homedX && digitalRead(PIN_X_ENDSTOP) == LOW) {
    stepperX.setCurrentPosition(0);
    stepperX.setSpeed(0);
    stepperX.moveTo(5.0 * PASSOS_POR_MM_X);
    while (stepperX.distanceToGo() != 0) stepperX.run();
    Serial.println("[Homing] Eixo X calibrado!");
  }
  
  display.println("Mover Eixo Y...");
  display.display();

  stepperY.setMaxSpeed(1000.0);
  stepperY.setAcceleration(500.0);
  stepperY.setSpeed(-500.0);
  unsigned long startY = millis();
  bool homedY = false;
  while (digitalRead(PIN_Y_ENDSTOP) == HIGH) {
    if (millis() - startY > 8000) {
      Serial.println("[Homing] Timeout no Eixo Y");
      break;
    }
    stepperY.runSpeed();
    delayMicroseconds(5);
    homedY = true;
  }
  if (homedY && digitalRead(PIN_Y_ENDSTOP) == LOW) {
    stepperY.setCurrentPosition(0);
    stepperY.setSpeed(0);
    stepperY.moveTo(5.0 * PASSOS_POR_MM_Y);
    while (stepperY.distanceToGo() != 0) stepperY.run();
    Serial.println("[Homing] Eixo Y calibrado!");
  }

  if (digitalRead(PIN_X_ENDSTOP) == LOW && digitalRead(PIN_Y_ENDSTOP) == LOW) {
    stepperX.setMaxSpeed(3500.0);
    stepperX.setAcceleration(4500.0);
    stepperY.setMaxSpeed(3500.0);
    stepperY.setAcceleration(4500.0);
    
    stepperX.moveTo(LIMITE_PASSOS_X / 2);
    stepperY.moveTo(LIMITE_PASSOS_Y / 2);
    unsigned long startMove = millis();
    while ((stepperX.distanceToGo() != 0 || stepperY.distanceToGo() != 0) && (millis() - startMove < 5000)) {
      stepperX.run();
      stepperY.run();
    }
  } else {
    stepperX.setMaxSpeed(600.0);
    stepperX.setAcceleration(1000.0);
    stepperY.setMaxSpeed(600.0);
    stepperY.setAcceleration(1000.0);
  }
}

// ==========================================================================
// MÓDULO WI-FI MANAGER (PORTAL CATIVO AP COM LAYOUT ACESSIVEL.JÁ)
// ==========================================================================
void handleScanNetworks() {
  int n = WiFi.scanNetworks();
  StaticJsonDocument<1024> doc;
  JsonArray array = doc.to<JsonArray>();

  for (int i = 0; i < n; ++i) {
    JsonObject obj = array.createNestedObject();
    obj["ssid"] = WiFi.SSID(i);
    obj["rssi"] = WiFi.RSSI(i);
    obj["secure"] = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
  }

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

void handleConfigSave() {
  if (server.hasArg("ssid") && server.hasArg("pass")) {
    wifi_ssid = server.arg("ssid");
    wifi_pass = server.arg("pass");
    // O servidor se mantém fixo em fabricamaquete.onrender.com
    server_ip = "fabricamaquete.onrender.com";

    preferences.begin("wifi-config", false);
    preferences.putString("ssid", wifi_ssid);
    preferences.putString("pass", wifi_pass);
    preferences.putString("ip", server_ip);
    preferences.end();

    String html = "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>";
    html += "<title>ACESSÍVEL.JÁ - Salvo</title>";
    html += "<style>body{font-family:system-ui,sans-serif;background:#0b0f19;color:#e2e8f0;text-align:center;padding:40px 20px;}";
    html += ".card{max-width:400px;margin:0 auto;background:#151c2c;padding:30px;border-radius:16px;border:1px solid #1e293b;box-shadow:0 10px 25px rgba(0,0,0,0.5);}";
    html += "h1{color:#00f2fe;font-size:22px;margin-bottom:10px;}p{color:#94a3b8;font-size:14px;}</style></head><body>";
    html += "<div class='card'><h1>Conexao Salva com Sucesso!</h1>";
    html += "<p>A Maquete Tatil vai reiniciar e conectar na sua rede <b>" + wifi_ssid + "</b>.</p>";
    html += "<p style='margin-top:20px;color:#00ff87;'>Aguarde alguns segundos e acesse o app resulta-app.vercel.app</p></div></body></html>";
    server.send(200, "text/html", html);

    delay(2000);
    ESP.restart();
  } else {
    server.send(400, "text/plain", "Parametros invalidos");
  }
}

void setupCaptivePortal() {
  apMode = true;
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("ACESSIVEL_JA_CONFIG");
  
  IPAddress apIP(192, 168, 4, 1);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));

  dnsServer.start(53, "*", apIP);

  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(" MODO CONFIGURACAO");
  display.drawFastHLine(0, 10, 128, SSD1306_WHITE);
  display.setCursor(0, 20);
  display.println("Conecte no WiFi:");
  display.println("ACESSIVEL_JA_CONFIG");
  display.setCursor(0, 42);
  display.println("No navegador acesse:");
  display.println("192.168.4.1");
  display.display();

  server.on("/scan", HTTP_GET, handleScanNetworks);

  server.on("/", HTTP_GET, []() {
    String html = "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>";
    html += "<title>ACESSÍVEL.JÁ - Configuração da Mesa Tátil</title>";
    html += "<style>";
    html += "*{box-sizing:border-box;margin:0;padding:0;}";
    html += "body{font-family:system-ui,-apple-system,sans-serif;background:#0b0f19;color:#e2e8f0;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px;}";
    html += ".card{width:100%;max-width:420px;background:#151c2c;border:1px solid #1e293b;border-radius:20px;padding:32px;box-shadow:0 20px 40px rgba(0,0,0,0.6);text-align:center;}";
    html += ".badge{display:inline-block;padding:4px 12px;background:rgba(0,242,254,0.1);color:#00f2fe;font-size:12px;font-weight:700;border-radius:20px;border:1px solid rgba(0,242,254,0.3);margin-bottom:12px;}";
    html += "h1{font-size:24px;font-weight:800;background:linear-gradient(90deg,#00f2fe,#00ff87);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px;}";
    html += "p{font-size:13px;color:#94a3b8;margin-bottom:24px;}";
    html += "label{display:block;text-align:left;font-size:12px;font-weight:600;color:#cbd5e1;margin-bottom:6px;}";
    html += "input,select{width:100%;padding:12px 14px;background:#0b0f19;border:1px solid #334155;border-radius:10px;color:#fff;font-size:14px;outline:none;margin-bottom:18px;transition:border-color 0.2s;}";
    html += "input:focus,select:focus{border-color:#00f2fe;}";
    html += ".btn-scan{width:100%;padding:10px;background:rgba(255,255,255,0.05);border:1px solid #334155;border-radius:10px;color:#cbd5e1;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:18px;display:flex;align-items:center;justify-content:center;gap:8px;}";
    html += ".btn-scan:hover{background:rgba(255,255,255,0.1);color:#fff;}";
    html += ".btn-submit{width:100%;padding:14px;background:linear-gradient(90deg,#00f2fe,#00ff87);border:none;border-radius:12px;color:#0b0f19;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 4px 15px rgba(0,242,254,0.3);transition:transform 0.1s;}";
    html += ".btn-submit:active{transform:scale(0.98);}";
    html += ".mac-info{margin-top:20px;font-size:11px;color:#64748b;word-break:break-all;}";
    html += "</style></head><body><div class='card'>";
    html += "<span class='badge'>CONFIGURAÇÃO DA MAQUETE</span>";
    html += "<h1>ACESSÍVEL.JÁ</h1>";
    html += "<p>Conecte a mesa tátil à rede Wi-Fi 2.4GHz para controle em tempo real.</p>";
    html += "<button type='button' class='btn-scan' onclick='scanWifi()'>🔄 Procurar Redes Wi-Fi Próximas</button>";
    html += "<form action='/save' method='POST'>";
    html += "<label for='ssid_select'>Selecione o Wi-Fi</label>";
    html += "<select id='ssid_select' onchange='setSSID(this.value)'><option value=''>Clique em Procurar Redes acima...</option></select>";
    html += "<input type='hidden' id='ssid' name='ssid' required>";
    html += "<label for='pass'>Senha do Wi-Fi</label>";
    html += "<input type='password' id='pass' name='pass' required placeholder='Digite a senha do Wi-Fi'>";
    html += "<button type='submit' class='btn-submit'>CONECTAR MAQUETE</button>";
    html += "</form>";
    html += "<div class='mac-info'>ID Físico (MAC): " + WiFi.macAddress() + "</div>";
    html += "</div>";
    html += "<script>";
    html += "function setSSID(v){document.getElementById('ssid').value=v;}";
    html += "function scanWifi(){";
    html += "var s=document.getElementById('ssid_select');s.innerHTML='<option>Buscando redes 2.4GHz...</option>';";
    html += "fetch('/scan').then(r=>r.json()).then(data=>{";
    html += "s.innerHTML='<option value=\"\">Escolha uma rede Wi-Fi...</option>';";
    html += "data.forEach(net=>{";
    html += "var opt=document.createElement('option');opt.value=net.ssid;opt.innerHTML=net.ssid+' ('+net.rssi+' dBm)';s.appendChild(opt);";
    html += "});";
    html += "}).catch(e=>{s.innerHTML='<option value=\"\">Erro ao buscar. Digite no Wi-Fi manual.</option>';});";
    html += "}";
    html += "</script></body></html>";
    server.send(200, "text/html", html);
  });

  server.on("/save", HTTP_POST, handleConfigSave);
  
  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1/", true);
    server.send(302, "text/plain", "");
  });

  server.begin();
  Serial.println("\n[AP Mode] Rede 'ACESSIVEL_JA_CONFIG' criada em 192.168.4.1.");
}

// ==========================================================================
// MÓDULO APRESENTAÇÃO
// ==========================================================================
void iniciarApresentacao() {
  emApresentacao = true;
  etapaApresentacao = 0;
  tempoEtapa = millis();
}

void processarApresentacao() {
  if (!emApresentacao) return;

  if (millis() - tempoEtapa > 4000) {
    if (etapaApresentacao < totalPontosApresentacao) {
      PontoApresentacao p = pontosApresentacao[etapaApresentacao];
      
      long targetX = (p.x / 100.0) * LIMITE_PASSOS_X;
      long targetY = (p.y / 100.0) * LIMITE_PASSOS_Y;
      
      stepperX.moveTo(targetX);
      stepperY.moveTo(targetY);

      StaticJsonDocument<256> doc;
      doc["status"] = "presentation";
      doc["desc"] = p.desc;
      doc["step"] = etapaApresentacao;
      char buffer[256];
      serializeJson(doc, buffer);
      webSocket.sendTXT(buffer);

      etapaApresentacao++;
      tempoEtapa = millis();
    } else {
      emApresentacao = false;
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

  if (doc.containsKey("mode") && doc["mode"] == "presentation") {
    iniciarApresentacao();
    return;
  }

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

  if (doc.containsKey("haptic") && doc["haptic"] == true) {
    String tipo = doc.containsKey("type") ? doc["type"].as<String>() : "toque";
    executarVibracao(tipo);
  }
}

void eventoWebSocket(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Desconectado!");
      wsConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.println("[WS] Conectado!");
      wsConnected = true;
      
      {
        StaticJsonDocument<256> doc;
        doc["event"] = "register";
        doc["mac"] = WiFi.macAddress();
        doc["type"] = "maquete";
        char buffer[256];
        serializeJson(doc, buffer);
        webSocket.sendTXT(buffer);
      }
      
      enviarEstadoBateria();
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
  pinMode(PIN_VIB_SENSOR, INPUT_PULLUP);
  pinMode(PIN_HAPTIC, OUTPUT);
  digitalWrite(PIN_HAPTIC, LOW);

  Wire.begin(21, 22);
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println("Erro: OLED nao inicializado");
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("   ACESSIVEL.JA");
    display.println("Portal Cativo");
    display.println("Iniciando...");
    display.display();
  }

  preferences.begin("wifi-config", true);
  wifi_ssid = preferences.getString("ssid", "");
  wifi_pass = preferences.getString("pass", "");
  // O servidor permanece fixo em fabricamaquete.onrender.com
  server_ip = "fabricamaquete.onrender.com";
  preferences.end();

  if (digitalRead(PIN_CONFIG_BUTTON) == LOW || wifi_ssid == "") {
    setupCaptivePortal();
    return;
  }

  WiFi.begin(wifi_ssid.c_str(), wifi_pass.c_str());
  int t = 0;
  Serial.printf("Tentando conectar a rede: %s ", wifi_ssid.c_str());
  
  while (WiFi.status() != WL_CONNECTED && t < 30) {
    delay(500);
    Serial.print(".");
    t++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    setupCaptivePortal();
    return;
  }

  Serial.printf("\n[WiFi] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());

  executarHoming();
  
  webSocket.begin("fabricamaquete.onrender.com", 80, "/ws/campo");
  Serial.println("[WebSocket] Conectando no Servidor Ponte Nuvem -> fabricamaquete.onrender.com:80");
  webSocket.onEvent(eventoWebSocket);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  if (apMode) {
    dnsServer.processNextRequest();
    server.handleClient();
    
    static unsigned long tPiscar = 0;
    if (millis() - tPiscar > 1000) {
      digitalWrite(PIN_HAPTIC, !digitalRead(PIN_HAPTIC));
      tPiscar = millis();
    }
  } else {
    webSocket.loop();
    processarApresentacao();
    
    if (digitalRead(PIN_X_ENDSTOP) == LOW) {
      if (stepperX.speed() < 0 || stepperX.distanceToGo() < 0) {
        stepperX.stop();
        stepperX.setCurrentPosition(0);
      }
    }
    if (digitalRead(PIN_Y_ENDSTOP) == LOW) {
      if (stepperY.speed() < 0 || stepperY.distanceToGo() < 0) {
        stepperY.stop();
        stepperY.setCurrentPosition(0);
      }
    }

    stepperX.run();
    stepperY.run();

    if (millis() - ultimoUpdateDisplay >= INTERVALO_DISPLAY_MS) {
      ultimoUpdateDisplay = millis();
      atualizarDisplayBateria();
    }

    if (millis() - ultimoEnvioBat >= INTERVALO_BAT_MS) {
      ultimoEnvioBat = millis();
      enviarEstadoBateria();
    }

    static unsigned long ultimoToque = 0;
    if (digitalRead(PIN_VIB_SENSOR) == LOW) { 
      if (millis() - ultimoToque > 350) {
        ultimoToque = millis();
        Serial.println("[Sensor] Toque de gol/interacao física!");
        executarVibracao("toque");
        webSocket.sendTXT("{\"event\":\"touch\",\"value\":true}");
      }
    }

    if (digitalRead(PIN_CONFIG_BUTTON) == LOW) {
      unsigned long tPressione = millis();
      while (digitalRead(PIN_CONFIG_BUTTON) == LOW) {
        if (millis() - tPressione > 3000) {
          preferences.begin("wifi-config", false);
          preferences.clear();
          preferences.end();
          ESP.restart();
        }
      }
    }
  }
}
