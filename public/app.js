// ==================== ESTADO DA APLICAÇÃO ====================
const state = {
  token: localStorage.getItem('nexus_token') || null,
  user: null,
  chats: [],
  currentChatId: null,
  currentChatTitle: 'Nova Missão',
  folders: [],
  activeFiles: new Set(),
  chatHistory: [],
  isGenerating: false,
  systemDirectives: localStorage.getItem('nexus_directives') || '',
  fileToMove: null // Armazena { filename, folder, pathId }
};

// ==================== ELEMENTOS DOM ====================
const el = {
  // Auth
  loginContainer: document.getElementById('login-container'),
  loginForm: document.getElementById('login-form'),
  loginAlert: document.getElementById('login-alert'),
  loginBtn: document.getElementById('login-btn'),
  usernameInput: document.getElementById('username'),
  passwordInput: document.getElementById('password'),

  // App Layout
  appContainer: document.getElementById('app-container'),
  modelSelect: document.getElementById('model-select'),
  btnLogout: document.getElementById('btn-logout'),
  btnMissionDirectives: document.getElementById('btn-mission-directives'),

  // Sidebar: Tabs & New Chat
  btnNewChat: document.getElementById('btn-new-chat'),
  tabBtnChats: document.getElementById('tab-btn-chats'),
  tabBtnFolders: document.getElementById('tab-btn-folders'),
  tabContentChats: document.getElementById('tab-content-chats'),
  tabContentFolders: document.getElementById('tab-content-folders'),
  chatsList: document.getElementById('chats-list'),
  totalChatsCount: document.getElementById('total-chats-count'),
  activeFilesCount: document.getElementById('active-files-count'),

  // Folders & Upload
  btnOpenCreateFolder: document.getElementById('btn-open-create-folder'),
  selectTargetFolder: document.getElementById('select-target-folder'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  uploadProgress: document.getElementById('upload-progress'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  foldersTree: document.getElementById('folders-tree'),

  // Chat Main
  currentChatTitle: document.getElementById('current-chat-title'),
  btnRenameCurrentChat: document.getElementById('btn-rename-current-chat'),
  activeContextBar: document.getElementById('active-context-bar'),
  contextSummaryText: document.getElementById('context-summary-text'),
  chatMessages: document.getElementById('chat-messages'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  btnSend: document.getElementById('btn-send'),
  btnClearChat: document.getElementById('btn-clear-chat'),
  chatStatusText: document.getElementById('chat-status-text'),

  // Modais
  modalCreateFolder: document.getElementById('modal-create-folder'),
  btnCloseFolderModal: document.getElementById('btn-close-folder-modal'),
  btnCancelCreateFolder: document.getElementById('btn-cancel-create-folder'),
  btnConfirmCreateFolder: document.getElementById('btn-confirm-create-folder'),
  newFolderName: document.getElementById('new-folder-name'),

  modalMoveFile: document.getElementById('modal-move-file'),
  btnCloseMoveModal: document.getElementById('btn-close-move-modal'),
  btnCancelMoveFile: document.getElementById('btn-cancel-move-file'),
  btnConfirmMoveFile: document.getElementById('btn-confirm-move-file'),
  moveFileTargetName: document.getElementById('move-file-target-name'),
  selectMoveDestination: document.getElementById('select-move-destination'),

  modalDirectives: document.getElementById('modal-directives'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  customInstructions: document.getElementById('custom-system-instructions'),
  btnSaveDirectives: document.getElementById('btn-save-directives'),
  btnResetDirectives: document.getElementById('btn-reset-directives')
};

// ==================== CONFIGURAÇÃO DO MARKED ====================
if (window.marked) {
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function(code, lang) {
      if (window.hljs && lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (e) {}
      }
      return code;
    }
  });
}

// ==================== INICIALIZAÇÃO ====================
async function init() {
  bindEvents();
  if (state.systemDirectives && el.customInstructions) {
    el.customInstructions.value = state.systemDirectives;
  }
  await checkAuth();
}

// ==================== AUTENTICAÇÃO ====================
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/verify', {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      state.user = data.user;
      showAppView();
      await loadInitialData();
    } else {
      showLoginView();
    }
  } catch (err) {
    showLoginView();
  }
}

function showLoginView() {
  el.loginContainer.classList.remove('hidden');
  el.appContainer.classList.add('hidden');
  state.token = null;
  localStorage.removeItem('nexus_token');
}

function showAppView() {
  el.loginContainer.classList.add('hidden');
  el.appContainer.classList.remove('hidden');
  el.chatInput.focus();
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  return headers;
}

async function loadInitialData() {
  await Promise.all([loadChats(), loadFolders()]);
}

// ==================== GESTÃO DE CHATS ====================
async function loadChats() {
  try {
    const res = await fetch('/api/chats', { headers: getAuthHeaders() });
    if (!res.ok) return;

    const data = await res.json();
    state.chats = data.chats || [];
    el.totalChatsCount.textContent = state.chats.length;

    renderChatsList();

    if (state.chats.length > 0) {
      // Se não houver chat ativo selecionado, abre o mais recente
      if (!state.currentChatId || !state.chats.some(c => c.id === state.currentChatId)) {
        await switchChat(state.chats[0].id);
      }
    } else {
      // Se não existir nenhum chat, cria o primeiro automaticamente
      await createNewChat();
    }
  } catch (err) {
    console.error('Erro ao carregar conversas:', err);
  }
}

function renderChatsList() {
  if (state.chats.length === 0) {
    el.chatsList.innerHTML = `
      <div style="text-align:center; padding:30px 10px; color:var(--text-dim); font-size:0.8rem;">
        <i class="fa-regular fa-comments" style="font-size:1.8rem; opacity:0.4; margin-bottom:8px; display:block;"></i>
        Nenhuma conversa criada.
      </div>
    `;
    return;
  }

  el.chatsList.innerHTML = state.chats.map(chat => {
    const isActive = chat.id === state.currentChatId;
    const dateStr = new Date(chat.updatedAt || chat.createdAt).toLocaleDateString([], {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });

    return `
      <div class="chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}">
        <i class="fa-regular fa-message chat-item-icon"></i>
        <div class="chat-item-info">
          <div class="chat-item-title" title="${chat.title}">${chat.title}</div>
          <div class="chat-item-meta">${dateStr} • ${chat.messageCount || 0} msgs</div>
        </div>
        <div class="chat-item-actions">
          <button class="btn-item-action rename" title="Renomear">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="btn-item-action delete" title="Excluir">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Eventos de clique nos chats
  el.chatsList.querySelectorAll('.chat-item').forEach(item => {
    const chatId = item.getAttribute('data-chat-id');
    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-item-action')) return;
      switchChat(chatId);
    });

    item.querySelector('.rename').addEventListener('click', (e) => {
      e.stopPropagation();
      renameChat(chatId);
    });

    item.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChat(chatId);
    });
  });
}

async function createNewChat() {
  try {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: 'Nova Missão',
        modelName: el.modelSelect.value
      })
    });

    if (res.ok) {
      const data = await res.json();
      state.chats.unshift(data.chat);
      el.totalChatsCount.textContent = state.chats.length;
      renderChatsList();
      await switchChat(data.chat.id);
    }
  } catch (err) {
    console.error('Erro ao criar chat:', err);
  }
}

async function switchChat(chatId) {
  try {
    state.currentChatId = chatId;
    renderChatsList(); // Atualiza destaque ativo

    const res = await fetch(`/api/chats/${chatId}`, { headers: getAuthHeaders() });
    if (!res.ok) return;

    const { chat } = await res.json();
    state.currentChatTitle = chat.title || 'Nova Missão';
    el.currentChatTitle.textContent = state.currentChatTitle;

    if (chat.modelName) {
      el.modelSelect.value = chat.modelName;
    }

    if (chat.customInstructions) {
      state.systemDirectives = chat.customInstructions;
      el.customInstructions.value = chat.customInstructions;
    }

    // Carregar histórico de mensagens
    state.chatHistory = [];
    el.chatMessages.innerHTML = '';

    if (chat.messages && chat.messages.length > 0) {
      chat.messages.forEach(msg => {
        appendMessage(msg.role, msg.content, false);
        state.chatHistory.push({ role: msg.role, content: msg.content });
      });
    } else {
      renderWelcomeHero();
    }

    el.chatInput.focus();
  } catch (err) {
    console.error('Erro ao alternar chat:', err);
  }
}

async function renameChat(chatId) {
  const current = state.chats.find(c => c.id === chatId);
  const newTitle = prompt('Novo nome para a missão/conversa:', current ? current.title : '');
  if (!newTitle || !newTitle.trim()) return;

  try {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title: newTitle.trim() })
    });

    if (res.ok) {
      if (current) current.title = newTitle.trim();
      if (state.currentChatId === chatId) {
        state.currentChatTitle = newTitle.trim();
        el.currentChatTitle.textContent = newTitle.trim();
      }
      renderChatsList();
    }
  } catch (err) {
    console.error('Erro ao renomear chat:', err);
  }
}

async function deleteChat(chatId) {
  if (!confirm('Deseja realmente excluir esta conversa e todo o seu histórico?')) return;

  try {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (res.ok) {
      state.chats = state.chats.filter(c => c.id !== chatId);
      el.totalChatsCount.textContent = state.chats.length;
      renderChatsList();

      if (state.currentChatId === chatId) {
        if (state.chats.length > 0) {
          await switchChat(state.chats[0].id);
        } else {
          await createNewChat();
        }
      }
    }
  } catch (err) {
    console.error('Erro ao excluir conversa:', err);
  }
}

function renderWelcomeHero() {
  el.chatMessages.innerHTML = `
    <div class="welcome-hero">
      <div class="hero-icon">
        <i class="fa-solid fa-crosshairs"></i>
      </div>
      <h2>CENTRAL OPERACIONAL PRONTA</h2>
      <p>Selecione ou crie pastas com relatórios e planilhas, ou inicie uma conversa tática direta com a IA.</p>
      <div class="quick-prompts">
        <button class="prompt-chip" data-prompt="Analise todos os documentos e pastas carregados e apresente um resumo executivo.">
          <i class="fa-solid fa-magnifying-glass-chart"></i> Resumo Geral de Dossiês
        </button>
        <button class="prompt-chip" data-prompt="Identifique os principais riscos, fragilidades e oportunidades operacionais.">
          <i class="fa-solid fa-triangle-exclamation"></i> Análise de Riscos & Oportunidades
        </button>
        <button class="prompt-chip" data-prompt="Elabore um plano estratégico acionável passo a passo para cumprir essa missão.">
          <i class="fa-solid fa-chess"></i> Criar Plano Tático
        </button>
      </div>
    </div>
  `;
}

// ==================== GESTÃO DE PASTAS E ARQUIVOS ====================
async function loadFolders() {
  try {
    const res = await fetch('/api/folders', { headers: getAuthHeaders() });
    if (!res.ok) return;

    const data = await res.json();
    state.folders = data.folders || [];

    // Preenche seletores de pasta
    updateFolderDropdowns();

    // Se houver novos arquivos, adiciona ao activeFiles se desejar
    state.folders.forEach(folder => {
      folder.files.forEach(f => {
        // Inicialmente mantemos todos selecionados por padrão
        if (!state.activeFiles.has(f.pathId)) {
          state.activeFiles.add(f.pathId);
        }
      });
    });

    renderFoldersTree();
    updateContextSummary();
  } catch (err) {
    console.error('Erro ao carregar pastas:', err);
  }
}

function updateFolderDropdowns() {
  const options = state.folders.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
  el.selectTargetFolder.innerHTML = options;
  el.selectMoveDestination.innerHTML = options;
}

function renderFoldersTree() {
  if (state.folders.length === 0) {
    el.foldersTree.innerHTML = `<div class="folder-empty-tip">Nenhuma pasta encontrada.</div>`;
    return;
  }

  el.foldersTree.innerHTML = state.folders.map((folder, fIndex) => {
    const allSelected = folder.files.length > 0 && folder.files.every(f => state.activeFiles.has(f.pathId));
    const isDefaultFolder = folder.name === 'Geral';

    return `
      <div class="folder-block open" data-folder="${folder.name}">
        <div class="folder-header">
          <i class="fa-solid fa-chevron-right folder-toggle-btn"></i>
          <input type="checkbox" class="folder-select-all" ${allSelected ? 'checked' : ''} title="Marcar todos os arquivos desta pasta para a IA">
          <i class="fa-solid fa-folder folder-icon"></i>
          <span class="folder-name">${folder.name}</span>
          <span class="folder-badge-count">${folder.filesCount}</span>
          ${!isDefaultFolder ? `
            <button class="folder-delete-btn" title="Excluir pasta">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
        <div class="folder-content">
          ${folder.files.length === 0 ? `
            <div class="folder-empty-tip">Pasta vazia. Arraste arquivos para cá.</div>
          ` : folder.files.map(file => {
            const isActive = state.activeFiles.has(file.pathId);
            const sizeKb = (file.size / 1024).toFixed(1);
            const iconClass = getFileIconClass(file.originalName);

            return `
              <div class="folder-file-item ${isActive ? 'active' : ''}" data-path-id="${file.pathId}" data-filename="${file.filename}" data-folder="${folder.name}">
                <input type="checkbox" class="file-checkbox" ${isActive ? 'checked' : ''} title="Incluir na IA">
                <i class="${iconClass}" style="color:var(--accent); font-size:0.85rem;"></i>
                <span class="file-name-text" title="${file.originalName}">${file.originalName}</span>
                <span class="file-size-tag">${sizeKb}KB</span>
                <div class="file-actions">
                  <button class="btn-file-tool move" title="Mover para outra pasta">
                    <i class="fa-solid fa-arrows-up-down-left-right"></i>
                  </button>
                  <button class="btn-file-tool delete" title="Excluir">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Eventos das pastas e arquivos
  el.foldersTree.querySelectorAll('.folder-block').forEach(fBlock => {
    const folderName = fBlock.getAttribute('data-folder');
    const header = fBlock.querySelector('.folder-header');
    const toggleBtn = fBlock.querySelector('.folder-toggle-btn');
    const selectAll = fBlock.querySelector('.folder-select-all');
    const deleteFolderBtn = fBlock.querySelector('.folder-delete-btn');

    // Expandir/colapsar pasta
    header.addEventListener('click', (e) => {
      if (e.target.closest('.folder-select-all') || e.target.closest('.folder-delete-btn')) return;
      fBlock.classList.toggle('open');
    });

    // Checkbox de selecionar todos da pasta
    selectAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const folderObj = state.folders.find(f => f.name === folderName);
      if (folderObj) {
        folderObj.files.forEach(f => {
          if (isChecked) state.activeFiles.add(f.pathId);
          else state.activeFiles.delete(f.pathId);
        });
      }
      renderFoldersTree();
      updateContextSummary();
    });

    // Excluir pasta
    if (deleteFolderBtn) {
      deleteFolderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolder(folderName);
      });
    }

    // Eventos dos arquivos internos
    fBlock.querySelectorAll('.folder-file-item').forEach(fileEl => {
      const pathId = fileEl.getAttribute('data-path-id');
      const filename = fileEl.getAttribute('data-filename');
      const checkbox = fileEl.querySelector('.file-checkbox');
      const moveBtn = fileEl.querySelector('.btn-file-tool.move');
      const deleteBtn = fileEl.querySelector('.btn-file-tool.delete');

      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          state.activeFiles.add(pathId);
          fileEl.classList.add('active');
        } else {
          state.activeFiles.delete(pathId);
          fileEl.classList.remove('active');
        }
        updateContextSummary();
      });

      moveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMoveModal(filename, folderName, pathId);
      });

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFile(pathId);
      });
    });
  });
}

function getFileIconClass(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return 'fa-solid fa-file-pdf';
    case 'csv': return 'fa-solid fa-file-csv';
    case 'json':
    case 'js':
    case 'py': return 'fa-solid fa-file-code';
    case 'txt':
    case 'md': return 'fa-solid fa-file-lines';
    default: return 'fa-solid fa-file';
  }
}

async function createFolder(name) {
  try {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name })
    });

    if (res.ok) {
      el.modalCreateFolder.classList.add('hidden');
      el.newFolderName.value = '';
      await loadFolders();
      notifyBanner(`Pasta "${name}" criada com sucesso!`);
    } else {
      const data = await res.json();
      alert(data.error || 'Erro ao criar pasta.');
    }
  } catch (err) {
    console.error('Erro ao criar pasta:', err);
  }
}

async function deleteFolder(folderName) {
  if (!confirm(`Deseja realmente excluir a pasta "${folderName}" e todos os seus arquivos?`)) return;

  try {
    const res = await fetch(`/api/folders/${encodeURIComponent(folderName)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (res.ok) {
      await loadFolders();
      notifyBanner(`Pasta "${folderName}" excluída.`);
    }
  } catch (err) {
    console.error('Erro ao excluir pasta:', err);
  }
}

function openMoveModal(filename, currentFolder, pathId) {
  state.fileToMove = { filename, currentFolder, pathId };
  el.moveFileTargetName.textContent = filename.replace(/^\d+-\d+-/, '');
  el.selectMoveDestination.value = currentFolder;
  el.modalMoveFile.classList.remove('hidden');
}

async function confirmMoveFile() {
  if (!state.fileToMove) return;
  const targetFolder = el.selectMoveDestination.value;

  if (targetFolder === state.fileToMove.currentFolder) {
    el.modalMoveFile.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/files/move', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        filename: state.fileToMove.filename,
        sourceFolder: state.fileToMove.currentFolder,
        targetFolder
      })
    });

    if (res.ok) {
      const data = await res.json();
      // Atualiza activeFiles com novo pathId
      state.activeFiles.delete(state.fileToMove.pathId);
      state.activeFiles.add(data.newPathId);

      el.modalMoveFile.classList.add('hidden');
      state.fileToMove = null;
      await loadFolders();
      notifyBanner('Arquivo movido com sucesso!');
    }
  } catch (err) {
    console.error('Erro ao mover arquivo:', err);
  }
}

async function handleFileUpload(fileList) {
  el.uploadProgress.classList.remove('hidden');
  el.progressBarFill.style.width = '10%';
  const targetFolder = el.selectTargetFolder.value || 'Geral';

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const formData = new FormData();
    formData.append('folder', targetFolder);
    formData.append('file', file);

    try {
      const headers = {};
      if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        state.activeFiles.add(data.file.pathId);
      }
    } catch (err) {
      console.error('Erro no upload de', file.name, err);
    }

    const progress = Math.round(((i + 1) / fileList.length) * 100);
    el.progressBarFill.style.width = `${progress}%`;
  }

  setTimeout(() => {
    el.uploadProgress.classList.add('hidden');
    el.progressBarFill.style.width = '0%';
    el.fileInput.value = '';
    loadFolders();
  }, 400);
}

async function deleteFile(pathId) {
  if (!confirm('Deseja realmente remover este arquivo?')) return;

  try {
    const res = await fetch(`/api/files?pathId=${encodeURIComponent(pathId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (res.ok) {
      state.activeFiles.delete(pathId);
      await loadFolders();
    }
  } catch (err) {
    console.error('Erro ao remover arquivo:', err);
  }
}

function updateContextSummary() {
  const count = state.activeFiles.size;
  el.activeFilesCount.textContent = count;
  if (count > 0) {
    el.activeContextBar.classList.remove('hidden');
    el.contextSummaryText.textContent = `${count} arquivo(s) ativo(s) no raciocínio da IA`;
  } else {
    el.activeContextBar.classList.add('hidden');
  }
}

function notifyBanner(msg) {
  const div = document.createElement('div');
  div.className = 'context-bar-pill';
  div.style.position = 'fixed';
  div.style.bottom = '24px';
  div.style.right = '24px';
  div.style.zIndex = '9999';
  div.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${msg}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

// ==================== CHAT & STREAMING ====================
async function sendMessage() {
  const message = el.chatInput.value.trim();
  if (!message || state.isGenerating) return;

  el.chatInput.value = '';
  el.chatInput.style.height = 'auto';

  const hero = el.chatMessages.querySelector('.welcome-hero');
  if (hero) hero.remove();

  appendMessage('user', message);
  state.chatHistory.push({ role: 'user', content: message });

  const modelMsgEl = appendMessage('model', '', true);
  const contentBody = modelMsgEl.querySelector('.message-body');

  state.isGenerating = true;
  el.btnSend.disabled = true;
  el.chatStatusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processando...`;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        chatId: state.currentChatId,
        message,
        history: state.chatHistory.slice(-10),
        activeFiles: Array.from(state.activeFiles),
        customInstructions: state.systemDirectives,
        modelName: el.modelSelect.value
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Erro HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.replace('data: ', '').trim();
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.text) {
                fullResponse += parsed.text;
                contentBody.innerHTML = marked.parse(fullResponse);
                addCopyButtonsToCode(contentBody);
                el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              console.warn('Erro ao decodificar SSE chunk:', e);
            }
          }
        }
      }
    }

    contentBody.classList.remove('typing-cursor');
    state.chatHistory.push({ role: 'model', content: fullResponse });

    // Atualiza a lista de chats para refletir novo título ou contagem de mensagens
    loadChats();

  } catch (err) {
    contentBody.classList.remove('typing-cursor');
    contentBody.innerHTML = `<span style="color: var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Falha na resposta:</strong> ${err.message}</span>`;
  } finally {
    state.isGenerating = false;
    el.btnSend.disabled = false;
    el.chatStatusText.innerHTML = `<i class="fa-solid fa-check"></i> Pronto`;
    el.chatInput.focus();
  }
}

function appendMessage(sender, text, isTyping = false) {
  const row = document.createElement('div');
  row.className = `message-row ${sender}`;

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const icon = sender === 'user' ? 'fa-solid fa-user' : 'fa-solid fa-brain';
  const name = sender === 'user' ? (state.user || 'Operador') : 'Gemini Operacional';

  let renderedContent = '';
  if (text) {
    renderedContent = sender === 'model' && window.marked ? marked.parse(text) : escapeHtml(text);
  }

  row.innerHTML = `
    <div class="message-avatar">
      <i class="${icon}"></i>
    </div>
    <div class="message-content-wrapper">
      <div class="message-header">
        <span class="message-sender">${name}</span>
        <span class="message-time">${timeStr}</span>
      </div>
      <div class="message-body ${isTyping ? 'typing-cursor' : ''}">${renderedContent}</div>
    </div>
  `;

  el.chatMessages.appendChild(row);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;

  if (sender === 'model' && text) {
    addCopyButtonsToCode(row.querySelector('.message-body'));
  }

  return row;
}

function addCopyButtonsToCode(container) {
  if (!container) return;
  const preElements = container.querySelectorAll('pre');
  preElements.forEach(pre => {
    if (pre.querySelector('.btn-copy-code')) return;

    const btn = document.createElement('button');
    btn.className = 'btn-copy-code';
    btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar';
    btn.style.position = 'absolute';
    btn.style.top = '8px';
    btn.style.right = '8px';
    btn.style.padding = '4px 8px';
    btn.style.fontSize = '0.75rem';
    btn.style.borderRadius = '4px';
    btn.style.border = '1px solid rgba(255,255,255,0.15)';
    btn.style.background = 'rgba(15,23,42,0.8)';
    btn.style.color = '#94a3b8';
    btn.style.cursor = 'pointer';

    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.innerText || pre.innerText;
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        setTimeout(() => {
          btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar';
        }, 2000);
      });
    });

    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==================== EVENTOS DA INTERFACE ====================
function bindEvents() {
  // Login
  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = el.usernameInput.value.trim();
    const password = el.passwordInput.value.trim();
    if (!username || !password) return;

    el.loginAlert.classList.add('hidden');
    el.loginBtn.disabled = true;
    el.loginBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Verificando...</span>`;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        state.token = data.token;
        localStorage.setItem('nexus_token', data.token);
        state.user = data.user.username;
        showAppView();
        await loadInitialData();
      } else {
        el.loginAlert.textContent = data.error || 'Credenciais inválidas.';
        el.loginAlert.classList.remove('hidden');
      }
    } catch (err) {
      el.loginAlert.textContent = 'Erro de conexão com o servidor.';
      el.loginAlert.classList.remove('hidden');
    } finally {
      el.loginBtn.disabled = false;
      el.loginBtn.innerHTML = `<span>Acessar Terminal</span><i class="fa-solid fa-arrow-right"></i>`;
    }
  });

  // Logout
  el.btnLogout.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    showLoginView();
  });

  // Novo Chat
  el.btnNewChat.addEventListener('click', createNewChat);

  // Alternar Abas da Sidebar
  el.tabBtnChats.addEventListener('click', () => {
    el.tabBtnChats.classList.add('active');
    el.tabBtnFolders.classList.remove('active');
    el.tabContentChats.classList.remove('hidden');
    el.tabContentFolders.classList.add('hidden');
  });

  el.tabBtnFolders.addEventListener('click', () => {
    el.tabBtnFolders.classList.add('active');
    el.tabBtnChats.classList.remove('active');
    el.tabContentFolders.classList.remove('hidden');
    el.tabContentChats.classList.add('hidden');
  });

  // Renomear chat atual pelo título
  el.btnRenameCurrentChat.addEventListener('click', () => {
    if (state.currentChatId) renameChat(state.currentChatId);
  });

  // Modal: Criar Pasta
  el.btnOpenCreateFolder.addEventListener('click', () => {
    el.modalCreateFolder.classList.remove('hidden');
    el.newFolderName.focus();
  });

  el.btnCloseFolderModal.addEventListener('click', () => el.modalCreateFolder.classList.add('hidden'));
  el.btnCancelCreateFolder.addEventListener('click', () => el.modalCreateFolder.classList.add('hidden'));

  el.btnConfirmCreateFolder.addEventListener('click', () => {
    const name = el.newFolderName.value.trim();
    if (name) createFolder(name);
  });

  el.newFolderName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const name = el.newFolderName.value.trim();
      if (name) createFolder(name);
    }
  });

  // Modal: Mover Arquivo
  el.btnCloseMoveModal.addEventListener('click', () => el.modalMoveFile.classList.add('hidden'));
  el.btnCancelMoveFile.addEventListener('click', () => el.modalMoveFile.classList.add('hidden'));
  el.btnConfirmMoveFile.addEventListener('click', confirmMoveFile);

  // Modal: Diretrizes
  el.btnMissionDirectives.addEventListener('click', () => {
    el.customInstructions.value = state.systemDirectives;
    el.modalDirectives.classList.remove('hidden');
  });

  el.btnCloseModal.addEventListener('click', () => el.modalDirectives.classList.add('hidden'));

  el.btnSaveDirectives.addEventListener('click', () => {
    state.systemDirectives = el.customInstructions.value.trim();
    localStorage.setItem('nexus_directives', state.systemDirectives);
    if (state.currentChatId) {
      fetch(`/api/chats/${state.currentChatId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ customInstructions: state.systemDirectives })
      });
    }
    el.modalDirectives.classList.add('hidden');
    notifyBanner('Diretrizes operacionais salvas!');
  });

  el.btnResetDirectives.addEventListener('click', () => {
    el.customInstructions.value = '';
    state.systemDirectives = '';
    localStorage.removeItem('nexus_directives');
    el.modalDirectives.classList.add('hidden');
  });

  // Auto-resize do textarea e envio
  el.chatInput.addEventListener('input', () => {
    el.chatInput.style.height = 'auto';
    el.chatInput.style.height = Math.min(el.chatInput.scrollHeight, 180) + 'px';
  });

  el.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.chatForm.dispatchEvent(new Event('submit'));
    }
  });

  el.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Limpar histórico visual
  el.btnClearChat.addEventListener('click', () => {
    if (confirm('Limpar mensagens desta tela? (O histórico pode ser restaurado recarregando o chat)')) {
      state.chatHistory = [];
      renderWelcomeHero();
    }
  });

  // Upload: Dropzone & File Input
  el.dropzone.addEventListener('click', () => el.fileInput.click());
  el.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropzone.classList.add('dragover');
  });
  el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('dragover'));
  el.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  });

  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
    }
  });

  // Quick Prompts
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.prompt-chip');
    if (chip) {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        el.chatInput.value = prompt;
        sendMessage();
      }
    }
  });
}

// Inicializa no carregamento do DOM
window.addEventListener('DOMContentLoaded', init);
