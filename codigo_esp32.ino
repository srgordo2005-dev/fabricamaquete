/* ==========================================================================
   PROJETO CAMPO TÁTIL - FIRMWARE ESP32
   Controle Suave de Motores NEMA 14 via WebSockets & Homing Automático
   Bibliotecas requeridas: AccelStepper, WebSocketsClient, ArduinoJson
   ========================================================================== */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <AccelStepper.h>

// ==========================================================================
// CONFIGURAÇÕES DE REDE E SERVIDOR API
// ==========================================================================
const char* ssid     = "SUA_REDE_WIFI";
const char* password = "SENHA_DO_WIFI";
const char* ws_host  = "192.168.1.100"; // IP do seu computador rodando o Servidor API
const int   ws_port  = 8080;
const char* ws_path  = "/ws/campo";     // Rota WebSocket do campo tátil

WebSocketsClient webSocket;

// ==========================================================================
// CONFIGURAÇÃO FÍSICA E MECÂNICA DOS MOTORES DE PASSO
// ==========================================================================
// Resolução e limites físicos da maquete (ajuste conforme sua mecânica)
const float CURSO_UTIL_X_MM = 160.0;    // Curso útil total do eixo X (carrinho vermelho)
const float CURSO_UTIL_Y_MM = 320.0;    // Curso útil total do eixo Y (ponte móvel)

// Passos por milímetro (Cálculo típico para polia GT2 de 20 dentes e microstepping de 1/16: 80 passos/mm)
const float PASSOS_POR_MM_X = 80.0;
const float PASSOS_POR_MM_Y = 80.0;

const long LIMITE_PASSOS_X = CURSO_UTIL_X_MM * PASSOS_POR_MM_X;
const long LIMITE_PASSOS_Y = CURSO_UTIL_Y_MM * PASSOS_POR_MM_Y;

// ==========================================================================
// PINAGEM DO ESP32 (Ajustável)
// ==========================================================================
// Eixo X (Carrinho do Ímã - Motor Lateral)
#define PIN_X_STEP 14
#define PIN_X_DIR  27
#define PIN_X_ENDSTOP 32 // Fim de curso X (Normalmente Fechado - NC para segurança)

// Eixo Y (Ponte Móvel - Motores das Laterais)
#define PIN_Y_STEP 12
#define PIN_Y_DIR  13
#define PIN_Y_ENDSTOP 33 // Fim de curso Y (Normalmente Fechado - NC)

// Atuador de Vibração Háptica (Ex: Transdutor linear ou solenoide pequeno sob a bola)
#define PIN_HAPTIC 25

// Configurando os motores no modo Driver (Passo/Direção dedicados)
AccelStepper stepperX(AccelStepper::DRIVER, PIN_X_STEP, PIN_X_DIR);
AccelStepper stepperY(AccelStepper::DRIVER, PIN_Y_STEP, PIN_Y_DIR);

// ==========================================================================
// CALIBRAÇÃO INICIAL (HOMING AUTOMÁTICO DO ZERO)
// ==========================================================================
void executarHoming() {
  Serial.println("\n--- INICIANDO CALIBRAÇÃO FÍSICA (HOMING) ---");
  
  // 1. CALIBRAR EIXO X (Mover para trás até tocar o sensor de fim de curso)
  Serial.println("Calibrando Eixo X...");
  stepperX.setMaxSpeed(1000.0);
  stepperX.setAcceleration(500.0);
  
  // Move devagar na direção do sensor (velocidade negativa = sentido anti-horário/traseiro)
  stepperX.setSpeed(-800.0);
  while (digitalRead(PIN_X_ENDSTOP) == HIGH) { 
    // Enquanto o sensor NÃO for pressionado (considerando resistor Pull-Up interno)
    stepperX.runSpeed();
    delayMicroseconds(10);
  }
  // Parar imediatamente e definir posição como ZERO
  stepperX.setCurrentPosition(0);
  stepperX.setSpeed(0);
  Serial.println("-> Eixo X Calibrado no ponto zero.");
  
  // Afasta 5mm do sensor para liberar o contato físico
  stepperX.moveTo(5.0 * PASSOS_POR_MM_X);
  while (stepperX.distanceToGo() != 0) {
    stepperX.run();
  }
  
  // 2. CALIBRAR EIXO Y (Mover para trás até tocar o sensor Y)
  Serial.println("Calibrando Eixo Y...");
  stepperY.setMaxSpeed(1000.0);
  stepperY.setAcceleration(500.0);
  
  stepperY.setSpeed(-800.0);
  while (digitalRead(PIN_Y_ENDSTOP) == HIGH) {
    stepperY.runSpeed();
    delayMicroseconds(10);
  }
  stepperY.setCurrentPosition(0);
  stepperY.setSpeed(0);
  Serial.println("-> Eixo Y Calibrado no ponto zero.");
  
  // Afasta 5mm do sensor Y
  stepperY.moveTo(5.0 * PASSOS_POR_MM_Y);
  while (stepperY.distanceToGo() != 0) {
    stepperY.run();
  }

  // Configura os limites reais de dinâmica pós-calibração (Velocidades rápidas para o jogo)
  stepperX.setMaxSpeed(3000.0);       // Passos por segundo maximo
  stepperX.setAcceleration(4000.0);    // Aceleração agressiva para seguir chutes
  
  stepperY.setMaxSpeed(3000.0);
  stepperY.setAcceleration(4000.0);

  // Mover bola para o Centro do Campo (50%, 50%) como posição inicial de jogo
  Serial.println("Posicionando bola no centro de jogo...");
  stepperX.moveTo(LIMITE_PASSOS_X / 2);
  stepperY.moveTo(LIMITE_PASSOS_Y / 2);
  while (stepperX.distanceToGo() != 0 || stepperY.distanceToGo() != 0) {
    stepperX.run();
    stepperY.run();
  }
  Serial.println("--- MAQUETE PRONTA E SINCRONIZADA ---\n");
}

// ==========================================================================
// RECEBIMENTO DE DADOS VIA WEBSOCKET (JSON)
// ==========================================================================
void tratarMensagemWS(uint8_t * payload, size_t length) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.print("Erro ao decodificar JSON do WebSocket: ");
    Serial.println(error.c_str());
    return;
  }

  // Extrai as coordenadas percentuais (0.0 a 100.0)
  if (doc.containsKey("x") && doc.containsKey("y")) {
    float x_pct = doc["x"];
    float y_pct = doc["y"];
    
    // Clampar valores por segurança
    x_pct = constrain(x_pct, 0.0, 100.0);
    y_pct = constrain(y_pct, 0.0, 100.0);
    
    // Converte a porcentagem recebida em passos físicos do motor
    long targetX = (x_pct / 100.0) * LIMITE_PASSOS_X;
    long targetY = (y_pct / 100.0) * LIMITE_PASSOS_Y;
    
    // Move os motores usando o planejador de aceleração suave (non-blocking)
    stepperX.moveTo(targetX);
    stepperY.moveTo(targetY);
    
    Serial.printf("Bola para: X: %.1f%% (%ld steps) | Y: %.1f%% (%ld steps)\n", x_pct, targetX, y_pct, targetY);
  }

  // Verifica feedback vibratório háptico (faltas, escanteios, gols)
  if (doc.containsKey("haptic") && doc["haptic"] == true) {
    int duration = doc.containsKey("pulse_ms") ? doc["pulse_ms"] : 200;
    Serial.printf("Ativando Feedback Vibratorio: %d ms\n", duration);
    
    digitalWrite(PIN_HAPTIC, HIGH);
    delay(duration); // Pulso rápido (bloqueia rápido apenas na vibração de gol/falta)
    digitalWrite(PIN_HAPTIC, LOW);
  }
}

// Eventos de conexão e desconexão do socket
void eventoWebSocket(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Desconectado do servidor!");
      break;
    case WStype_CONNECTED:
      Serial.println("[WS] Conectado com sucesso!");
      break;
    case WStype_TEXT:
      tratarMensagemWS(payload, length);
      break;
    default:
      break;
  }
}

// ==========================================================================
// CONFIGURAÇÃO GERAL (SETUP)
// ==========================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configurar Pinos de Fim de Curso e Vibração
  pinMode(PIN_X_ENDSTOP, INPUT_PULLUP);
  pinMode(PIN_Y_ENDSTOP, INPUT_PULLUP);
  pinMode(PIN_HAPTIC, OUTPUT);
  digitalWrite(PIN_HAPTIC, LOW);

  // Conectar Wi-Fi
  Serial.printf("\nConectando ao Wi-Fi: %s\n", ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWi-Fi Conectado! IP: %s\n", WiFi.localIP().toString().c_str());

  // Executa Homing físico para segurança da mecânica
  executarHoming();

  // Configura cliente WebSocket
  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(eventoWebSocket);
  webSocket.setReconnectInterval(5000); // Tentar reconectar a cada 5s se cair
}

// ==========================================================================
// LOOP DE EXECUÇÃO PRINCIPAL
// ==========================================================================
void loop() {
  // Processa mensagens pendentes do WebSocket
  webSocket.loop();
  
  // Roda o algoritmo de passo a passo de aceleração dos motores de forma assíncrona
  stepperX.run();
  stepperY.run();
}
