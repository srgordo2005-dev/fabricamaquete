/* ==========================================================================
   CAMPO TÁTIL PRO - LÓGICA E INTERATIVIDADE (VANILLA JAVASCRIPT)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const canvas = document.getElementById('pitch-canvas');
  const ctx = canvas.getContext('2d');
  const pitchWrapper = document.getElementById('pitch-wrapper');
  
  const valXEl = document.getElementById('val-x');
  const valYEl = document.getElementById('val-y');
  const statusDot = document.getElementById('status-dot');
  const connText = document.getElementById('conn-text');
  
  const btnBle = document.getElementById('btn-ble');
  const btnWs = document.getElementById('btn-ws');
  const btnCenter = document.getElementById('btn-center');
  const btnSwapSides = document.getElementById('btn-swap-sides');
  
  // Botões Hápticos
  const btnVibGoal = document.getElementById('btn-vib-goal');
  const btnVibFoul = document.getElementById('btn-vib-foul');
  const btnVibPost = document.getElementById('btn-vib-post');
  const btnVibCorner = document.getElementById('btn-vib-corner');

  // Botões de Simulação
  const simAttackRight = document.getElementById('sim-attack-right');
  const simPenalty = document.getElementById('sim-penalty');
  const simZigzag = document.getElementById('sim-zigzag');
  const simStop = document.getElementById('sim-stop');

  // Sliders
  const sliderAudioDelay = document.getElementById('slider-audio-delay');
  const lblAudioDelay = document.getElementById('lbl-audio-delay');
  const sliderLerp = document.getElementById('slider-lerp');
  const lblLerpSpeed = document.getElementById('lbl-lerp-speed');

  // Comando de Voz
  const btnVoice = document.getElementById('btn-voice-command');
  const voiceLog = document.getElementById('voice-log');

  // ==========================================================================
  // ESTADO DA APLICAÇÃO
  // ==========================================================================
  let ballX = 50.0; // % (0 a 100)
  let ballY = 50.0; // % (0 a 100)
  let isDragging = false;
  let isSwapped = false; // Se true, inverte 2º tempo (X = 100 - X)
  
  let bluetoothDevice = null;
  let bleCharacteristic = null;
  let webSocket = null;
  let isConnected = false;

  let activeAnimationId = null;
  let trailParticles = [];

  // ==========================================================================
  // CONFIGURAÇÃO DO CANVAS E RENDERIZAÇÃO
  // ==========================================================================
  function resizeCanvas() {
    canvas.width = pitchWrapper.clientWidth;
    canvas.height = pitchWrapper.clientHeight;
    renderPitch();
  }

  window.addEventListener('resize', resizeCanvas);

  function renderPitch() {
    const w = canvas.width;
    const h = canvas.height;

    // Fundo Gramado com gradiente
    const pitchGrad = ctx.createLinearGradient(0, 0, w, h);
    pitchGrad.addColorStop(0, '#0a2315');
    pitchGrad.addColorStop(1, '#113a22');
    ctx.fillStyle = pitchGrad;
    ctx.fillRect(0, 0, w, h);

    // Listras do Gramado
    const stripeWidth = w / 10;
    for (let i = 0; i < 10; i += 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, h);
    }

    // Linhas Brancas do Campo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;

    // Linha Externa (Margem)
    const margin = 16;
    const pw = w - margin * 2;
    const ph = h - margin * 2;
    ctx.strokeRect(margin, margin, pw, ph);

    // Linha Central
    ctx.beginPath();
    ctx.moveTo(w / 2, margin);
    ctx.lineTo(w / 2, h - margin);
    ctx.stroke();

    // Círculo Central
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, ph * 0.22, 0, Math.PI * 2);
    ctx.stroke();

    // Ponto Central
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Área do Gol Esquerdo
    const boxWidth = pw * 0.18;
    const boxHeight = ph * 0.5;
    ctx.strokeRect(margin, h / 2 - boxHeight / 2, boxWidth, boxHeight);

    // Área do Gol Direito
    ctx.strokeRect(w - margin - boxWidth, h / 2 - boxHeight / 2, boxWidth, boxHeight);

    // Traves (Esquerda e Direita em Amarelo Dourado)
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(margin - 6, h / 2 - boxHeight * 0.25, 6, boxHeight * 0.5);
    ctx.fillRect(w - margin, h / 2 - boxHeight * 0.25, 6, boxHeight * 0.5);

    // Rastro da Bola (Particles)
    trailParticles.forEach((p, idx) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(96, 239, 255, ${p.alpha})`;
      ctx.fill();
      p.alpha -= 0.03;
      p.radius *= 0.95;
    });
    trailParticles = trailParticles.filter(p => p.alpha > 0);

    // Bola de Luz Branca Brilhante
    const realX = margin + (ballX / 100) * pw;
    const realY = margin + (ballY / 100) * ph;

    // Brilho Externo (Glow Effect)
    const glowGrad = ctx.createRadialGradient(realX, realY, 4, realX, realY, 28);
    glowGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glowGrad.addColorStop(0.3, 'rgba(96, 239, 255, 0.8)');
    glowGrad.addColorStop(0.7, 'rgba(0, 255, 135, 0.4)');
    glowGrad.addColorStop(1, 'rgba(0, 255, 135, 0)');

    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(realX, realY, 28, 0, Math.PI * 2);
    ctx.fill();

    // Centro Sólido da Bola
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(realX, realY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ff87';
    ctx.lineWidth = 2;
    ctx.stroke();

    requestAnimationFrame(renderPitch);
  }

  // ==========================================================================
  // EVENTOS DE TOQUE / MOUSE (DRAGGING NO TABLET)
  // ==========================================================================
  function updateBallPosition(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const margin = 16;
    const pw = rect.width - margin * 2;
    const ph = rect.height - margin * 2;

    let xPixels = clientX - rect.left - margin;
    let yPixels = clientY - rect.top - margin;

    // Clampar para o limite do campo (0 a 100%)
    let pctX = Math.max(0, Math.min(100, (xPixels / pw) * 100));
    let pctY = Math.max(0, Math.min(100, (yPixels / ph) * 100));

    // Se estiver no 2º tempo (lado invertido)
    if (isSwapped) {
      pctX = 100 - pctX;
    }

    ballX = parseFloat(pctX.toFixed(1));
    ballY = parseFloat(pctY.toFixed(1));

    // Atualiza Displays
    valXEl.textContent = `${ballX}%`;
    valYEl.textContent = `${ballY}%`;

    // Adiciona partícula de rastro
    const realX = margin + (pctX / 100) * pw;
    const realY = margin + (pctY / 100) * ph;
    trailParticles.push({ x: realX, y: realY, alpha: 0.8, radius: 12 });

    // Envia dados para o ESP32-S3
    sendCoordinatesToESP32(ballX, ballY, false);
  }

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    updateBallPosition(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) updateBallPosition(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  // Eventos para Telas Touch (Tablet/iPad)
  canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    if (e.touches.length > 0) {
      updateBallPosition(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length > 0) {
      updateBallPosition(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => { isDragging = false; });

  // ==========================================================================
  // COMUNICAÇÃO COM O ESP32-S3 (BLE & WEBSOCKET)
  // ==========================================================================
  function setConnectedState(connected, typeName = 'Conectado') {
    isConnected = connected;
    if (connected) {
      statusDot.className = 'status-dot connected';
      connText.textContent = typeName;
    } else {
      statusDot.className = 'status-dot disconnected';
      connText.textContent = 'Desconectado';
    }
  }

  // Bluetooth LE
  btnBle.addEventListener('click', async () => {
    try {
      if (!navigator.bluetooth) {
        alert('Seu navegador/dispositivo não suporta a Web Bluetooth API. Use o Chrome no Android/Windows ou adicione via WebSockets.');
        return;
      }
      connText.textContent = 'Buscando ESP32...';
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['0000181a-0000-1000-8000-00805f9b34fb']
      });

      connText.textContent = 'Conectando...';
      const server = await bluetoothDevice.gatt.connect();
      setConnectedState(true, 'BLE Conectado');
    } catch (err) {
      console.log('Bluetooth erro ou cancelado:', err);
      setConnectedState(false);
    }
  });

  // WebSocket
  btnWs.addEventListener('click', () => {
    const ip = prompt('Digite o IP do ESP32-S3 ou Servidor Backend:', '192.168.1.100');
    if (!ip) return;

    try {
      webSocket = new WebSocket(`ws://${ip}:8080/ws/campo`);
      webSocket.onopen = () => {
        setConnectedState(true, 'WS Conectado');
      };
      webSocket.onclose = () => {
        setConnectedState(false);
      };
      webSocket.onerror = () => {
        alert('Erro ao conectar via WebSocket');
        setConnectedState(false);
      };
    } catch (e) {
      alert('Erro na conexão WebSocket');
    }
  });

  function sendCoordinatesToESP32(x, y, haptic = false, pulseMs = 200) {
    const payload = JSON.stringify({ x: x, y: y, haptic: haptic, pulse_ms: pulseMs });

    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.send(payload);
    }

    if (bleCharacteristic) {
      const encoder = new TextEncoder();
      bleCharacteristic.writeValue(encoder.encode(payload));
    }
  }

  // ==========================================================================
  // AÇÕES HÁPTICAS & SIMULAÇÃO
  // ==========================================================================
  function triggerHapticFeedback(patternName, ms = 200) {
    // Se o dispositivo do tablet suportar vibração nativa
    if (navigator.vibrate) {
      if (patternName === 'goal') navigator.vibrate([200, 100, 200, 100, 400]);
      else if (patternName === 'foul') navigator.vibrate([400, 100, 400]);
      else navigator.vibrate(ms);
    }
    // Envia instrução de vibração para a maquete física
    sendCoordinatesToESP32(ballX, ballY, true, ms);
  }

  btnVibGoal.addEventListener('click', () => triggerHapticFeedback('goal', 500));
  btnVibFoul.addEventListener('click', () => triggerHapticFeedback('foul', 350));
  btnVibPost.addEventListener('click', () => triggerHapticFeedback('post', 250));
  btnVibCorner.addEventListener('click', () => triggerHapticFeedback('corner', 150));

  // Botões de Ação Rápidos
  btnCenter.addEventListener('click', () => {
    ballX = 50.0;
    ballY = 50.0;
    valXEl.textContent = '50.0%';
    valYEl.textContent = '50.0%';
    sendCoordinatesToESP32(50.0, 50.0);
  });

  btnSwapSides.addEventListener('click', () => {
    isSwapped = !isSwapped;
    btnSwapSides.style.background = isSwapped ? 'rgba(0, 255, 135, 0.3)' : 'rgba(255, 255, 255, 0.07)';
    btnSwapSides.textContent = isSwapped ? '🔄 Lado Invertido (2º T)' : '🔄 Inverter Lado (2º Tempo)';
  });

  // ==========================================================================
  // JOGADAS PRÉ-PROGRAMADAS (SIMULAÇÃO)
  // ==========================================================================
  function stopAnimation() {
    if (activeAnimationId) {
      cancelAnimationFrame(activeAnimationId);
      activeAnimationId = null;
    }
  }

  simStop.addEventListener('click', stopAnimation);

  simAttackRight.addEventListener('click', () => {
    stopAnimation();
    let step = 0;
    function animate() {
      step += 0.015;
      if (step > 1) { stopAnimation(); return; }
      ballX = 20 + step * 75;
      ballY = 50 + Math.sin(step * Math.PI * 3) * 30;
      valXEl.textContent = `${ballX.toFixed(1)}%`;
      valYEl.textContent = `${ballY.toFixed(1)}%`;
      sendCoordinatesToESP32(ballX, ballY);
      activeAnimationId = requestAnimationFrame(animate);
    }
    animate();
  });

  simPenalty.addEventListener('click', () => {
    stopAnimation();
    ballX = 85.0;
    ballY = 50.0;
    setTimeout(() => {
      triggerHapticFeedback('goal', 400);
      ballX = 98.0;
      ballY = 35.0;
    }, 1000);
  });

  simZigzag.addEventListener('click', () => {
    stopAnimation();
    let step = 0;
    function animate() {
      step += 0.01;
      if (step > 1) { stopAnimation(); return; }
      ballX = 50 + Math.cos(step * Math.PI * 4) * 35;
      ballY = 50 + Math.sin(step * Math.PI * 4) * 35;
      valXEl.textContent = `${ballX.toFixed(1)}%`;
      valYEl.textContent = `${ballY.toFixed(1)}%`;
      sendCoordinatesToESP32(ballX, ballY);
      activeAnimationId = requestAnimationFrame(animate);
    }
    animate();
  });

  // Sliders
  sliderAudioDelay.addEventListener('input', (e) => {
    lblAudioDelay.textContent = `${e.target.value}s`;
  });

  sliderLerp.addEventListener('input', (e) => {
    lblLerpSpeed.textContent = `${e.target.value}%`;
  });

  // ==========================================================================
  // COMANDO DE VOZ (WEB SPEECH API)
  // ==========================================================================
  btnVoice.addEventListener('click', () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceLog.textContent = 'Reconhecimento de voz não suportado neste navegador.';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    voiceLog.textContent = 'Listening... Fale seu comando!';

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase();
      voiceLog.textContent = `Ouvi: "${text}"`;

      if (text.includes('centro') || text.includes('meio')) {
        btnCenter.click();
      } else if (text.includes('gol') || text.includes('chute')) {
        triggerHapticFeedback('goal', 500);
      } else if (text.includes('ataque') || text.includes('direita')) {
        simAttackRight.click();
      }
    };

    recognition.onerror = () => {
      voiceLog.textContent = 'Não entendi o comando. Tente novamente.';
    };

    recognition.start();
  });

  // Inicializa o Canvas
  resizeCanvas();
});
