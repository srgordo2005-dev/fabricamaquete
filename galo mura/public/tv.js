// TV Interface Logic - Galo Mura

let activeFightState = null;
let lastWinnerId = null;

// Initialize clock
function updateClock() {
  const now = new Date();
  
  // Format to Brasília Time (UTC-3)
  const options = {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  const formatter = new Intl.DateTimeFormat('pt-BR', options);
  document.getElementById('tv-clock').textContent = formatter.format(now);
}

setInterval(updateClock, 1000);
updateClock();

// Fetch local IP address for administration connection
async function fetchConnectionInfo() {
  try {
    const res = await fetch('/api/ip');
    const info = await res.json();
    const adminUrl = `http://${info.ip}:${info.port}/admin.html`;
    
    document.getElementById('local-url-text').textContent = adminUrl;
    
    // Generate QR Code if library is available
    if (typeof QRCode !== 'undefined') {
      document.getElementById('qrcode-canvas').innerHTML = '';
      new QRCode(document.getElementById('qrcode-canvas'), {
        text: adminUrl,
        width: 100,
        height: 100,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
      });
    }
  } catch (err) {
    console.error('Falha ao buscar IP do servidor:', err);
  }
}

fetchConnectionInfo();

// Fetch data from local database
async function fetchDatabaseState() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Falha ao carregar banco de dados');
    const data = await res.json();
    
    updateFighters(data);
    updateSponsors(data.sponsors);
    renderModalSponsorsList(data.sponsors);
    renderModalQueueList(data.queue);
  } catch (err) {
    console.error('Erro na requisição de dados:', err);
  }
}

let dbState = { roosters: [], sponsors: [], activeFight: null, history: [] };

// Update the two fighters on the screen & modal control panel
function updateFighters(data) {
  dbState = data;
  const { activeFight } = data;
  
  const cardLeft = document.getElementById('card-left');
  const cardRight = document.getElementById('card-right');
  const matchStatus = document.getElementById('match-status');
  
  // Modal Elements
  const mNoFight = document.getElementById('modal-no-fight');
  const mFightActive = document.getElementById('modal-fight-active');
  const mDeclareWinner = document.getElementById('modal-declare-winner');
  const mFinishSection = document.getElementById('modal-finish-section');
  const mWinnerText = document.getElementById('modal-winner-text');
  
  if (!activeFight || !activeFight.active) {
    // No active fight - TV view
    document.getElementById('name-left').textContent = "Aguardando";
    document.getElementById('spec-color-left').textContent = "-";
    document.getElementById('spec-ring-left').textContent = "-";
    document.getElementById('spec-weight-left').textContent = "-";
    document.getElementById('spec-owner-left').textContent = "-";
    const ribLeft = document.getElementById('spec-ribbon-left');
    if (ribLeft) {
      ribLeft.textContent = "-";
      ribLeft.style.background = "transparent";
    }
    
    document.getElementById('name-right').textContent = "Aguardando";
    document.getElementById('spec-color-right').textContent = "-";
    document.getElementById('spec-ring-right').textContent = "-";
    document.getElementById('spec-weight-right').textContent = "-";
    document.getElementById('spec-owner-right').textContent = "-";
    const ribRight = document.getElementById('spec-ribbon-right');
    if (ribRight) {
      ribRight.textContent = "-";
      ribRight.style.background = "transparent";
    }
    
    matchStatus.textContent = "VS";
    matchStatus.style.background = "";
    matchStatus.style.color = "";
    
    cardLeft.className = "fighter-card left panel";
    cardRight.className = "fighter-card right panel";
    
    // Modal View
    if (mNoFight) mNoFight.style.display = 'block';
    if (mFightActive) mFightActive.style.display = 'none';
    
    activeFightState = null;
    lastWinnerId = null;
    return;
  }

  // Read roosters directly from activeFight
  const r1 = activeFight.rooster1;
  const r2 = activeFight.rooster2;
  
  // Update TV
  if (r1) {
    document.getElementById('name-left').textContent = r1.name;
    document.getElementById('spec-color-left').textContent = r1.plumage;
    document.getElementById('spec-ring-left').textContent = r1.ring || "-";
    document.getElementById('spec-weight-left').textContent = r1.weight || "-";
    document.getElementById('spec-owner-left').textContent = r1.owner;
    
    const ribLeft = document.getElementById('spec-ribbon-left');
    if (ribLeft) {
      ribLeft.textContent = r1.ribbon || "Nenhuma";
      ribLeft.style.background = getRibbonColor(r1.ribbon);
      ribLeft.style.color = r1.ribbon === 'Branca' ? '#000' : '#fff';
    }
  }
  
  if (r2) {
    document.getElementById('name-right').textContent = r2.name;
    document.getElementById('spec-color-right').textContent = r2.plumage;
    document.getElementById('spec-ring-right').textContent = r2.ring || "-";
    document.getElementById('spec-weight-right').textContent = r2.weight || "-";
    document.getElementById('spec-owner-right').textContent = r2.owner;
    
    const ribRight = document.getElementById('spec-ribbon-right');
    if (ribRight) {
      ribRight.textContent = r2.ribbon || "Nenhuma";
      ribRight.style.background = getRibbonColor(r2.ribbon);
      ribRight.style.color = r2.ribbon === 'Branca' ? '#000' : '#fff';
    }
  }
  
  // Update Modal
  if (mNoFight) mNoFight.style.display = 'none';
  if (mFightActive) mFightActive.style.display = 'block';
  
  if (r1) {
    document.getElementById('modal-name-left').textContent = r1.name;
    document.getElementById('modal-owner-left').textContent = `Prop.: ${r1.owner}`;
  }
  if (r2) {
    document.getElementById('modal-name-right').textContent = r2.name;
    document.getElementById('modal-owner-right').textContent = `Prop.: ${r2.owner}`;
  }
  
  // Handle winner highlights
  if (activeFight.winnerId) {
    // TV Highlights
    if (activeFight.winnerId === 'rooster1') {
      cardLeft.className = "fighter-card left panel winner";
      cardRight.className = "fighter-card right panel loser";
      matchStatus.textContent = "GANHOU";
      matchStatus.style.background = "var(--color-blue)";
      matchStatus.style.color = "white";
    } else if (activeFight.winnerId === 'rooster2') {
      cardLeft.className = "fighter-card left panel loser";
      cardRight.className = "fighter-card right panel winner";
      matchStatus.textContent = "GANHOU";
      matchStatus.style.background = "var(--color-red)";
      matchStatus.style.color = "white";
    } else if (activeFight.winnerId === 'draw') {
      cardLeft.className = "fighter-card left panel loser";
      cardRight.className = "fighter-card right panel loser";
      matchStatus.textContent = "EMPATE";
      matchStatus.style.background = "#4b5563";
      matchStatus.style.color = "white";
    }
    
    // Modal Highlights
    if (mDeclareWinner) mDeclareWinner.style.display = 'none';
    if (mFinishSection) {
      mFinishSection.style.display = 'block';
      if (activeFight.winnerId === 'rooster1') {
        mWinnerText.textContent = `Vencedor: ${r1 ? r1.name : 'Azul'}`;
      } else if (activeFight.winnerId === 'rooster2') {
        mWinnerText.textContent = `Vencedor: ${r2 ? r2.name : 'Vermelho'}`;
      } else {
        mWinnerText.textContent = 'Resultado: Empate';
      }
    }
  } else {
    // Underway
    cardLeft.className = "fighter-card left panel";
    cardRight.className = "fighter-card right panel";
    matchStatus.textContent = "VS";
    matchStatus.style.background = "";
    matchStatus.style.color = "";
    
    // Modal
    if (mDeclareWinner) mDeclareWinner.style.display = 'flex';
    if (mFinishSection) mFinishSection.style.display = 'none';
  }
}

// Update sponsors with dynamic layout resizing based on count
function updateSponsors(sponsors = []) {
  const sponsorsGrid = document.getElementById('sponsors-grid');
  sponsorsGrid.innerHTML = '';
  
  const sponsorsSection = document.querySelector('.tv-sponsors-section');
  const tvArena = document.querySelector('.tv-arena');
  if (sponsors.length === 0) {
    if (sponsorsSection) sponsorsSection.style.display = 'none';
    if (tvArena) tvArena.style.height = 'calc(100vh - 110px)'; // Full page height minus header
    return;
  } else {
    if (sponsorsSection) sponsorsSection.style.display = 'block';
    if (tvArena) tvArena.style.height = ''; // Reset to CSS default
  }
  
  // Apply progressive sizing class based on count
  if (sponsors.length === 1) {
    sponsorsGrid.className = "sponsors-grid count-1";
  } else if (sponsors.length === 2) {
    sponsorsGrid.className = "sponsors-grid count-2";
  } else if (sponsors.length === 3) {
    sponsorsGrid.className = "sponsors-grid count-3";
  } else if (sponsors.length <= 5) {
    sponsorsGrid.className = "sponsors-grid count-medium";
  } else {
    sponsorsGrid.className = "sponsors-grid count-many";
  }
  
  sponsors.forEach(sp => {
    const item = document.createElement('div');
    
    if (sp.logo) {
      // Image logo (transparency requested)
      item.className = 'sponsor-item has-logo';
      const img = document.createElement('img');
      img.src = sp.logo;
      img.alt = sp.name;
      img.className = 'sponsor-logo';
      img.onerror = () => {
        item.className = 'sponsor-item';
        item.innerHTML = `<span class="sponsor-text">${sp.name}</span>`;
      };
      item.appendChild(img);
    } else {
      // Text-only logo
      item.className = 'sponsor-item';
      const text = document.createElement('span');
      text.className = 'sponsor-text';
      text.textContent = sp.name;
      item.appendChild(text);
    }
    
    sponsorsGrid.appendChild(item);
  });
}

// Write state back to server
async function saveState() {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbState)
    });
    fetchDatabaseState();
  } catch (err) {
    console.error('Erro ao salvar dados:', err);
  }
}

// CONTROL MODAL INTERACTIVE LOGIC
const modal = document.getElementById('control-modal');
const btnOpen = document.getElementById('btn-open-control');
const btnClose = document.getElementById('btn-close-modal');

if (btnOpen) {
  btnOpen.addEventListener('click', () => {
    modal.style.display = 'flex';
  });
}

if (btnClose) {
  btnClose.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

// Close modal when clicking outside content
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

// Toggle QR Code visibility
const btnToggleQr = document.getElementById('btn-toggle-qr');
const qrCanvas = document.getElementById('qrcode-canvas');
if (btnToggleQr && qrCanvas) {
  btnToggleQr.addEventListener('click', () => {
    if (qrCanvas.style.display === 'none') {
      qrCanvas.style.display = 'flex';
      btnToggleQr.innerHTML = '<span id="eye-icon">🙈</span> Esconder QR Code';
    } else {
      qrCanvas.style.display = 'none';
      btnToggleQr.innerHTML = '<span id="eye-icon">👁️</span> Mostrar QR Code';
    }
  });
}

// Launch new match from TV Modal (Save to queue)
const newMatchForm = document.getElementById('modal-new-match-form');
if (newMatchForm) {
  newMatchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const r1_name = document.getElementById('m-rooster1-name').value.trim();
    const r1_owner = document.getElementById('m-rooster1-owner').value.trim();
    const r1_plumage = document.getElementById('m-rooster1-plumage').value;
    const r1_ring = document.getElementById('m-rooster1-ring').value.trim();
    const r1_weight = document.getElementById('m-rooster1-weight').value.trim();
    const r1_ribbon = document.getElementById('m-rooster1-ribbon').value;

    const r2_name = document.getElementById('m-rooster2-name').value.trim();
    const r2_owner = document.getElementById('m-rooster2-owner').value.trim();
    const r2_plumage = document.getElementById('m-rooster2-plumage').value;
    const r2_ring = document.getElementById('m-rooster2-ring').value.trim();
    const r2_weight = document.getElementById('m-rooster2-weight').value.trim();
    const r2_ribbon = document.getElementById('m-rooster2-ribbon').value;
    
    if (!r1_name || !r1_owner || !r2_name || !r2_owner) return;
    
    const newMatch = {
      id: Date.now().toString(),
      rooster1: { name: r1_name, owner: r1_owner, plumage: r1_plumage, ring: r1_ring, weight: r1_weight, ribbon: r1_ribbon },
      rooster2: { name: r2_name, owner: r2_owner, plumage: r2_plumage, ring: r2_ring, weight: r2_weight, ribbon: r2_ribbon },
      winnerId: null,
      active: true
    };
    
    if (!dbState.queue) dbState.queue = [];
    
    // If no active fight is running, start this one immediately
    if (!dbState.activeFight || !dbState.activeFight.active) {
      dbState.activeFight = newMatch;
    } else {
      // Put in queue list
      dbState.queue.push(newMatch);
    }
    
    await saveState();
    newMatchForm.reset();
  });
}

// Declare winner from PC modal
async function setWinner(side) {
  if (!dbState.activeFight) return;
  
  if (side === 'left') {
    dbState.activeFight.winnerId = 'rooster1';
  } else if (side === 'right') {
    dbState.activeFight.winnerId = 'rooster2';
  } else if (side === 'draw') {
    dbState.activeFight.winnerId = 'draw';
  }
  
  await saveState();
  await archiveFight(); // Automatically archive and promote next match
}

// Skip current active match
async function skipFight() {
  if (!confirm('Deseja pular o combate atual? (Ele não será salvo no histórico)')) return;
  
  if (dbState.queue && dbState.queue.length > 0) {
    dbState.activeFight = dbState.queue.shift();
  } else {
    dbState.activeFight = null;
  }
  
  await saveState();
}

// Reset winner selection from PC modal
async function resetWinner() {
  if (!dbState.activeFight) return;
  dbState.activeFight.winnerId = null;
  await saveState();
}

// Confirm and archive fight from PC modal
async function archiveFight() {
  const { activeFight } = dbState;
  if (!activeFight || !activeFight.active) return;
  
  const r1 = activeFight.rooster1;
  const r2 = activeFight.rooster2;
  
  let winnerText = "Empate";
  if (activeFight.winnerId === 'rooster1') {
    winnerText = `${r1.name} (Prop.: ${r1.owner})`;
  } else if (activeFight.winnerId === 'rooster2') {
    winnerText = `${r2.name} (Prop.: ${r2.owner})`;
  }
  
  const historyEntry = {
    id: Date.now().toString(),
    rooster1: { name: r1.name, owner: r1.owner, plumage: r1.plumage },
    rooster2: { name: r2.name, owner: r2.owner, plumage: r2.plumage },
    winner: winnerText,
    date: new Date().toLocaleDateString('pt-BR'),
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  };
  
  dbState.history.push(historyEntry);
  
  // Load next fight from queue if any exist
  if (dbState.queue && dbState.queue.length > 0) {
    dbState.activeFight = dbState.queue.shift();
  } else {
    dbState.activeFight = null;
  }
  
  await saveState();
}

// Poll state every 1 second
setInterval(fetchDatabaseState, 1000);
fetchDatabaseState();

// Render Queue list inside PC Control Modal
function renderModalQueueList(queue = []) {
  const queueList = document.getElementById('modal-queue-list');
  if (!queueList) return;
  queueList.innerHTML = '';
  
  if (queue.length === 0) {
    queueList.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 15px 0; font-size: 0.85rem;">Fila vazia. Cadastre combates acima!</div>';
    return;
  }
  
  queue.forEach((fight, index) => {
    const item = document.createElement('div');
    item.className = 'queue-item-row';
    item.draggable = true;
    item.dataset.index = index;
    
    // Style row
    item.style = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 6px; cursor: grab; margin-bottom: 4px;';
    
    // Drag handlers
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      item.style.opacity = '0.5';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = index;
      if (fromIndex === toIndex) return;
      
      // Reorder
      const element = dbState.queue.splice(fromIndex, 1)[0];
      dbState.queue.splice(toIndex, 0, element);
      await saveState();
    });
    
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 800; color: var(--accent-gold); font-size: 0.9rem;">#${index + 1}</span>
        <div style="font-size: 0.8rem;">
          <strong style="color: #60a5fa;">${fight.rooster1.name}</strong> <span style="font-size:0.7rem; color:var(--text-muted);">(${fight.rooster1.plumage})</span>
          <span style="color: var(--text-muted);">vs</span>
          <strong style="color: #f87171;">${fight.rooster2.name}</strong> <span style="font-size:0.7rem; color:var(--text-muted);">(${fight.rooster2.plumage})</span>
        </div>
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        <button onclick="moveQueueItem(${index}, -1)" style="padding: 2px 5px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass); color: #fff; border-radius: 4px; cursor: pointer; font-size: 0.65rem;">🔺</button>
        <button onclick="moveQueueItem(${index}, 1)" style="padding: 2px 5px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass); color: #fff; border-radius: 4px; cursor: pointer; font-size: 0.65rem;">🔻</button>
        <button onclick="deleteQueueItem(${index})" style="padding: 2px 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; border-radius: 4px; cursor: pointer; font-size: 0.65rem;">Remover</button>
      </div>
    `;
    
    queueList.appendChild(item);
  });
}

// Move item up or down in array
async function moveQueueItem(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= dbState.queue.length) return;
  const temp = dbState.queue[index];
  dbState.queue[index] = dbState.queue[targetIndex];
  dbState.queue[targetIndex] = temp;
  await saveState();
}

// Delete item from queue
async function deleteQueueItem(index) {
  if (!confirm('Deseja remover este combate da fila?')) return;
  dbState.queue.splice(index, 1);
  await saveState();
}

// Render Sponsors list inside the PC Control Modal
function renderModalSponsorsList(sponsors = []) {
  const modalSponsorsList = document.getElementById('modal-sponsors-list');
  if (!modalSponsorsList) return;
  modalSponsorsList.innerHTML = '';
  
  if (sponsors.length === 0) {
    modalSponsorsList.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 10px 0;">Nenhum patrocinador cadastrado</div>';
    return;
  }
  
  sponsors.forEach(sp => {
    const row = document.createElement('div');
    row.style = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; margin-bottom: 4px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-glass);';
    
    let logoHtml = '';
    if (sp.logo) {
      logoHtml = `<img src="${sp.logo}" style="width: 25px; height: 25px; object-fit: contain; border-radius: 4px; background: white;" />`;
    } else {
      logoHtml = `<span style="font-size: 0.65rem; color: var(--text-muted); border: 1px solid var(--border-glass); padding: 2px 4px; border-radius: 3px;">TXT</span>`;
    }
    
    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        ${logoHtml}
        <span style="font-weight: 600; color: #fff; font-size: 0.8rem;">${sp.name}</span>
      </div>
      <button onclick="deleteSponsor('${sp.id}')" style="padding: 2px 6px; font-size: 0.7rem; border: 1px solid var(--color-red); color: var(--color-red); border-radius: 4px; cursor: pointer; background: transparent;">Remover</button>
    `;
    modalSponsorsList.appendChild(row);
  });
}

// Delete sponsor from PC Modal
async function deleteSponsor(id) {
  if (!confirm('Deseja realmente remover este patrocinador?')) return;
  dbState.sponsors = dbState.sponsors.filter(sp => sp.id !== id);
  await saveState();
}

// Handle PC Modal Sponsor Creation and Logo Reading
const modalSponsorForm = document.getElementById('modal-sponsor-form');
const modalSponsorLogoInput = document.getElementById('m-sponsor-logo-file');
const modalUploadBtnLabel = document.getElementById('m-upload-btn-label');
let mBase64Logo = "";

if (modalSponsorLogoInput) {
  modalSponsorLogoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (modalUploadBtnLabel) modalUploadBtnLabel.textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = function(event) {
      mBase64Logo = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

if (modalSponsorForm) {
  modalSponsorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('m-sponsor-name');
    const name = nameInput.value.trim();
    if (!name) return;
    
    const newSponsor = {
      id: Date.now().toString(),
      name: name,
      logo: mBase64Logo || null
    };
    
    dbState.sponsors.push(newSponsor);
    await saveState();
    
    // Reset Form
    modalSponsorForm.reset();
    mBase64Logo = "";
    if (modalUploadBtnLabel) modalUploadBtnLabel.textContent = "Escolher Imagem";
  });
}

function getRibbonColor(color) {
  switch (color) {
    case 'Azul': return '#1d4ed8'; // Darker blue for premium contrast
    case 'Vermelha': return '#b91c1c'; // Darker red
    case 'Amarela': return '#eab308'; // Amber/Gold
    case 'Verde': return '#047857'; // Emerald
    case 'Branca': return '#ffffff';
    default: return 'transparent';
  }
}
