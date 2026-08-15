// Admin Panel Logic - Galo Mura

let dbState = { roosters: [], sponsors: [], activeFight: null, history: [] };

// Toast helper
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Tab switcher
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
  
  // Find button to activate
  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.textContent.toLowerCase().includes(
    tab === 'match' ? 'combate' : tab === 'register' ? 'cadastro' : tab === 'sponsors' ? 'patrocinadores' : 'relatório'
  ));
  if (activeBtn) activeBtn.classList.add('active');
  
  document.getElementById(`tab-${tab}`).style.display = 'block';
}

// Fetch database state
async function fetchState() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Erro ao buscar dados');
    dbState = await res.json();
    
    updateUI();
  } catch (err) {
    console.error('Erro ao atualizar tela admin:', err);
  }
}

// Write state back to server
async function saveState() {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbState)
    });
    if (!res.ok) throw new Error('Erro ao salvar dados');
    fetchState();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar alterações no servidor');
  }
}

// File input handler (change label on file select)
const fileInput = document.getElementById('sponsor-logo-file');
fileInput.addEventListener('change', () => {
  const label = document.getElementById('upload-btn-label');
  if (fileInput.files.length > 0) {
    label.textContent = `Imagem: ${fileInput.files[0].name}`;
    label.style.borderColor = "#10b981";
    label.style.color = "#10b981";
  } else {
    label.textContent = "Selecionar Imagem";
    label.style.borderColor = "";
    label.style.color = "";
  }
});

// Create Sponsor with File Upload
document.getElementById('sponsor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('sponsor-name').value.trim();
  const file = fileInput.files[0];
  
  if (!name) return;
  
  if (file) {
    // Read file as Base64 and send to server API
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const base64Data = reader.result;
        const res = await fetch('/api/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, base64Data })
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Erro no upload');
        }
        
        showToast(`Patrocinador ${name} adicionado!`);
        document.getElementById('sponsor-form').reset();
        document.getElementById('upload-btn-label').textContent = "Selecionar Imagem";
        document.getElementById('upload-btn-label').style.borderColor = "";
        document.getElementById('upload-btn-label').style.color = "";
        fetchState();
      } catch (err) {
        console.error(err);
        showToast(`Erro ao carregar logo: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  } else {
    // Text-only sponsor
    const newSponsor = {
      id: Date.now().toString(),
      name: name,
      logo: ""
    };
    dbState.sponsors.push(newSponsor);
    await saveState();
    showToast(`Patrocinador ${name} adicionado!`);
    document.getElementById('sponsor-form').reset();
  }
});

// Delete Sponsor
async function deleteSponsor(id) {
  if (!confirm('Deseja remover este patrocinador?')) return;
  dbState.sponsors = dbState.sponsors.filter(s => s.id !== id);
  await saveState();
  showToast('Patrocinador removido!');
}

// Launch fight (Add to queue)
document.getElementById('new-match-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const r1_name = document.getElementById('rooster1-name').value.trim();
  const r1_owner = document.getElementById('rooster1-owner').value.trim();
  const r1_plumage = document.getElementById('rooster1-plumage').value;
  const r1_ring = document.getElementById('rooster1-ring').value.trim();
  const r1_weight = document.getElementById('rooster1-weight').value.trim();
  const r1_ribbon = document.getElementById('rooster1-ribbon').value;

  const r2_name = document.getElementById('rooster2-name').value.trim();
  const r2_owner = document.getElementById('rooster2-owner').value.trim();
  const r2_plumage = document.getElementById('rooster2-plumage').value;
  const r2_ring = document.getElementById('rooster2-ring').value.trim();
  const r2_weight = document.getElementById('rooster2-weight').value.trim();
  const r2_ribbon = document.getElementById('rooster2-ribbon').value;
  
  if (!r1_name || !r1_owner || !r2_name || !r2_owner) return;
  
  const newMatch = {
    id: Date.now().toString(),
    rooster1: { name: r1_name, owner: r1_owner, plumage: r1_plumage, ring: r1_ring, weight: r1_weight, ribbon: r1_ribbon },
    rooster2: { name: r2_name, owner: r2_owner, plumage: r2_plumage, ring: r2_ring, weight: r2_weight, ribbon: r2_ribbon },
    winnerId: null,
    active: true
  };
  
  if (!dbState.queue) dbState.queue = [];
  
  if (!dbState.activeFight || !dbState.activeFight.active) {
    dbState.activeFight = newMatch;
    showToast('Confronto iniciado na TV!');
  } else {
    dbState.queue.push(newMatch);
    showToast('Confronto adicionado à fila!');
  }
  
  await saveState();
  document.getElementById('new-match-form').reset();
});

// Declare winner
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
  showToast('Vencedor declarado e arquivado!');
  await archiveFight(); // Auto archive and load next!
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
  showToast('Combate pulado!');
}

// Reset winner selection before confirmation
async function resetWinner() {
  if (!dbState.activeFight) return;
  dbState.activeFight.winnerId = null;
  await saveState();
  showToast('Resultado cancelado.');
}

// Confirm and archive fight to history
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
  
  // Create history entry
  const historyEntry = {
    id: Date.now().toString(),
    rooster1: { name: r1.name, owner: r1.owner, plumage: r1.plumage },
    rooster2: { name: r2.name, owner: r2.owner, plumage: r2.plumage },
    winner: winnerText,
    date: new Date().toLocaleDateString('pt-BR'),
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  };
  
  dbState.history.push(historyEntry);
  
  // Promote next match from queue if any exist
  if (dbState.queue && dbState.queue.length > 0) {
    dbState.activeFight = dbState.queue.shift();
  } else {
    dbState.activeFight = null;
  }
  
  await saveState();
  showToast('Rodada salva no relatório!');
}

// Reset entire database
async function resetDatabase() {
  if (!confirm('ATENÇÃO: Isso apagará TODOS os patrocinadores e o histórico do relatório. Tem certeza?')) return;
  
  dbState = {
    roosters: [],
    sponsors: [],
    activeFight: null,
    history: []
  };
  
  await saveState();
  showToast('Torneio reiniciado do zero!');
}

// Update admin UI components based on DB state
function updateUI() {
  const { sponsors, activeFight, history } = dbState;
  
  // 1. Active Fight control UI
  const noFightMsg = document.getElementById('no-fight-message');
  const activeFightDiv = document.getElementById('active-fight-controls');
  const declareWinnerSection = document.getElementById('declare-winner-section');
  const finishFightSection = document.getElementById('finish-fight-section');
  const winnerStatusText = document.getElementById('winner-status-text');
  
  if (!activeFight || !activeFight.active) {
    noFightMsg.style.display = 'block';
    activeFightDiv.style.display = 'none';
  } else {
    noFightMsg.style.display = 'none';
    activeFightDiv.style.display = 'block';
    
    const r1 = activeFight.rooster1;
    const r2 = activeFight.rooster2;
    
    document.getElementById('ctrl-name-left').textContent = r1 ? r1.name : '-';
    document.getElementById('ctrl-owner-left').textContent = r1 ? `Prop.: ${r1.owner}` : '-';
    
    document.getElementById('ctrl-name-right').textContent = r2 ? r2.name : '-';
    document.getElementById('ctrl-owner-right').textContent = r2 ? `Prop.: ${r2.owner}` : '-';
    
    // Toggle between declaring and confirming winner
    if (activeFight.winnerId) {
      declareWinnerSection.style.display = 'none';
      finishFightSection.style.display = 'block';
      
      if (activeFight.winnerId === 'rooster1') {
        winnerStatusText.textContent = `Vencedor Escolhido: ${r1 ? r1.name : 'Canto Azul'}`;
      } else if (activeFight.winnerId === 'rooster2') {
        winnerStatusText.textContent = `Vencedor Escolhido: ${r2 ? r2.name : 'Canto Vermelho'}`;
      } else {
        winnerStatusText.textContent = 'Resultado: Empate';
      }
    } else {
      declareWinnerSection.style.display = 'flex';
      finishFightSection.style.display = 'none';
    }
  }
  
  // 2. Sponsors list
  const listSponsors = document.getElementById('sponsors-list');
  listSponsors.innerHTML = '';
  
  if (sponsors.length === 0) {
    listSponsors.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 10px 0;">Nenhum patrocinador cadastrado.</p>';
  } else {
    sponsors.forEach(s => {
      const item = document.createElement('div');
      item.className = 'report-item';
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          ${s.logo ? `<img src="${s.logo}" style="width: 40px; height: 30px; object-fit: contain; background: #ffffff; border-radius: 4px; padding: 2px;">` : `<div style="width: 40px; height: 30px; border: 1px dashed var(--border-glass); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: var(--text-muted)">Sem Logo</div>`}
          <strong>${s.name}</strong>
        </div>
        <button class="btn-secondary" onclick="deleteSponsor('${s.id}')" style="color: var(--color-red); border-color: rgba(239,68,68,0.2); padding: 5px 10px; font-size: 0.8rem;">Excluir</button>
      `;
      listSponsors.appendChild(item);
    });
  }
  
  // 3. Report List
  const listReport = document.getElementById('report-list');
  const emptyReport = document.getElementById('report-empty');
  listReport.innerHTML = '';
  
  if (history.length === 0) {
    emptyReport.style.display = 'block';
  } else {
    emptyReport.style.display = 'none';
    
    // Render in reverse chronological order (newest first)
    const printTableBody = document.getElementById('print-report-table-body');
    if (printTableBody) printTableBody.innerHTML = '';

    [...history].reverse().forEach(h => {
      // Backwards compatibility with legacy text records
      const r1 = typeof h.rooster1 === 'string' ? { name: h.rooster1.split(' ')[0], owner: h.rooster1.includes('(') ? h.rooster1.split('(')[1].replace(')','') : '-', plumage: '-' } : h.rooster1;
      const r2 = typeof h.rooster2 === 'string' ? { name: h.rooster2.split(' ')[0], owner: h.rooster2.includes('(') ? h.rooster2.split('(')[1].replace(')','') : '-', plumage: '-' } : h.rooster2;
      const winner = h.winner;

      const item = document.createElement('div');
      item.className = 'report-item';
      const dateText = h.date ? `${h.date} às ` : '';
      item.innerHTML = `
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${dateText}${h.timestamp}</span><br>
          <strong>${r1.name}</strong> (${r1.plumage} - Prop.: ${r1.owner}) <em>vs</em> <strong>${r2.name}</strong> (${r2.plumage} - Prop.: ${r2.owner})
        </div>
        <div>
          Vencedor: <span class="report-winner">${winner}</span>
        </div>
      `;
      listReport.appendChild(item);

      // Populate print table rows
      if (printTableBody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="color:#000; padding: 8px; border: 1px solid #ddd;">${dateText}${h.timestamp}</td>
          <td style="color:#000; padding: 8px; border: 1px solid #ddd;"><strong>${r1.name}</strong> (${r1.plumage}) - Prop: ${r1.owner}</td>
          <td style="color:#000; padding: 8px; border: 1px solid #ddd;"><strong>${r2.name}</strong> (${r2.plumage}) - Prop: ${r2.owner}</td>
          <td style="color:#000; padding: 8px; border: 1px solid #ddd; font-weight: bold;">${winner}</td>
        `;
        printTableBody.appendChild(tr);
      }
    });
  }
  
  // 4. Render Mobile Queue List
  renderQueueList(dbState.queue);
}

// Render Mobile Queue List
function renderQueueList(queue = []) {
  const queueList = document.getElementById('queue-list');
  if (!queueList) return;
  queueList.innerHTML = '';
  
  if (!queue || queue.length === 0) {
    queueList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 15px 0;">Fila vazia. Cadastre combates acima.</p>';
    return;
  }
  
  queue.forEach((fight, index) => {
    const item = document.createElement('div');
    item.className = 'report-item';
    item.style.padding = '8px 12px';
    item.style.marginBottom = '6px';
    
    item.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <span style="font-weight: 800; color: var(--accent-gold); font-size: 0.8rem;">Combate #${index + 1}</span>
        <span style="font-size: 0.85rem;">
          <strong style="color: #60a5fa;">${fight.rooster1.name}</strong> <span style="font-size: 0.7rem; color: var(--text-muted);">(${fight.rooster1.plumage})</span>
          vs
          <strong style="color: #f87171;">${fight.rooster2.name}</strong> <span style="font-size: 0.7rem; color: var(--text-muted);">(${fight.rooster2.plumage})</span>
        </span>
      </div>
      <div style="display: flex; gap: 5px; align-items: center; margin-top: 4px;">
        <button class="btn-secondary" onclick="moveQueueItem(${index}, -1)" style="padding: 3px 6px; font-size: 0.75rem;">🔺</button>
        <button class="btn-secondary" onclick="moveQueueItem(${index}, 1)" style="padding: 3px 6px; font-size: 0.75rem;">🔻</button>
        <button class="btn-secondary" onclick="deleteQueueItem(${index})" style="color: var(--color-red); border-color: rgba(239,68,68,0.2); padding: 3px 6px; font-size: 0.75rem;">Remover</button>
      </div>
    `;
    queueList.appendChild(item);
  });
}

// Move mobile queue item
async function moveQueueItem(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= dbState.queue.length) return;
  const temp = dbState.queue[index];
  dbState.queue[index] = dbState.queue[targetIndex];
  dbState.queue[targetIndex] = temp;
  await saveState();
}

// Delete mobile queue item
async function deleteQueueItem(index) {
  if (!confirm('Deseja remover este combate da fila?')) return;
  dbState.queue.splice(index, 1);
  await saveState();
}

// Initial fetch and start loop polling
fetchState();
setInterval(fetchState, 1500);
