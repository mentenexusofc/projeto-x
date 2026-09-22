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
  fileToMove: null, // Armazena { filename, folder, pathId }
  agendaEvents: [],
  selectedEvent: null,
  calCurrentDate: new Date(),
  calSelectedDate: new Date()
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
  btnSidebarToggle: document.getElementById('btn-sidebar-toggle'),
  sidebar: document.getElementById('sidebar'),

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
  btnResetDirectives: document.getElementById('btn-reset-directives'),
  // Agenda & Google Calendar
  btnAgenda: document.getElementById('btn-agenda'),
  modalAgenda: document.getElementById('modal-agenda'),
  btnCloseAgendaModal: document.getElementById('btn-close-agenda-modal'),
  btnCalToday: document.getElementById('btn-cal-today'),
  btnCalPrev: document.getElementById('btn-cal-prev'),
  btnCalNext: document.getElementById('btn-cal-next'),
  calMonthYear: document.getElementById('cal-month-year'),
  btnCalCreateEvent: document.getElementById('btn-cal-create-event'),
  calendarDaysGrid: document.getElementById('calendar-days-grid'),
  calPanelDayEvents: document.getElementById('cal-panel-day-events'),
  calSelectedDayTitle: document.getElementById('cal-selected-day-title'),
  btnQuickAddToDay: document.getElementById('btn-quick-add-to-day'),
  calDayEventsList: document.getElementById('cal-day-events-list'),
  calPanelForm: document.getElementById('cal-panel-form'),
  calFormTitle: document.getElementById('cal-form-title'),
  btnCancelCalForm: document.getElementById('btn-cancel-cal-form'),
  calEventForm: document.getElementById('cal-event-form'),
  calEventId: document.getElementById('cal-event-id'),
  calEventTitulo: document.getElementById('cal-event-titulo'),
  calEventPasta: document.getElementById('cal-event-pasta'),
  calEventPrioridade: document.getElementById('cal-event-prioridade'),
  calEventInicio: document.getElementById('cal-event-inicio'),
  calEventFim: document.getElementById('cal-event-fim'),
  calEventDescricao: document.getElementById('cal-event-descricao'),
  btnCancelEventBtn: document.getElementById('btn-cancel-event-btn')
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
  // Restore state from localStorage
  const savedActiveFiles = localStorage.getItem('nexus_activeFiles');
  if (savedActiveFiles) state.activeFiles = new Set(JSON.parse(savedActiveFiles));

  const savedCurrentChat = localStorage.getItem('nexus_currentChatId');
  if (savedCurrentChat) state.currentChatId = savedCurrentChat;

  const savedFolderState = localStorage.getItem('nexus_folderTreeState');
  if (savedFolderState) {
    // Reapply folder tree state
    const folderState = JSON.parse(savedFolderState);
    document.querySelectorAll('.folder-block').forEach((block, i) => {
      if (folderState[i]) {
        block.classList.add('open');
      }
    });
  }

  const savedModel = localStorage.getItem('nexus_selectedModel');
  if (savedModel) el.modelSelect.value = savedModel;

  const savedUploadFolder = localStorage.getItem('nexus_uploadFolder');
  if (savedUploadFolder) el.selectTargetFolder.value = savedUploadFolder;

  // Set initial sidebar state for mobile
  const isMobile = window.innerWidth <= 900;
  if (isMobile) {
    el.sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
  }

  bindEvents();
  if (state.systemDirectives && el.customInstructions) {
    el.customInstructions.value = state.systemDirectives;
  }
  await checkAuth();
  await loadAgenda();
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
    saveState();
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

    // Also populate agenda pasta select
    const agendaPastaSelect = document.getElementById('agenda-pasta');
    if (agendaPastaSelect) {
      const folderOptions = state.folders.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
      agendaPastaSelect.innerHTML = `<option value="Geral">Geral</option>${folderOptions}`;
    }

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

async function loadAgenda() {
  try {
    const res = await fetch('/api/agenda', { headers: getAuthHeaders() });
    if (!res.ok) return;

    const data = await res.json();
    state.agendaEvents = data.eventos || [];
    renderAgendaList();
  } catch (err) {
    console.error('Erro ao carregar agenda:', err);
  }
}

function renderAgendaList() {
  if (state.agendaEvents.length === 0) {
    el.agendaList.innerHTML = `<div class="agenda-list.empty">Nenhum evento encontrado.</div>`;
    return;
  }

  el.agendaList.innerHTML = state.agendaEvents.map((event, index) => {
    const dataInicio = event.dataInicio ? new Date(event.dataInicio) : new Date();
    const dataFim = event.dataFim ? new Date(event.dataFim) : new Date();
    const hoje = new Date();
    const isHoje = dataInicio.toDateString() === hoje.toDateString();
    const isFuturo = dataInicio > hoje;
    const isPassado = dataInicio < hoje;

    let statusClass = '';
    let statusText = '';

    if (isPassado) {
      statusClass = 'evento-passado';
      statusText = 'Passado';
    } else if (isHoje) {
      statusClass = 'evento-hoje';
      statusText = 'Hoje';
    } else if (isFuturo) {
      statusClass = 'evento-futuro';
      statusText = 'Futuro';
    }

    return `
      <div class="agenda-event" data-event-id="${event.id}">
        <div class="event-data">
          <div class="event-titulo" title="${event.titulo}">${event.titulo}</div>
          <div class="event-meta">
            ${event.pasta ? `<i class="fa-solid fa-folder"></i> ${event.pasta}` : ''}
            ${event.dataInicio ? `<i class="fa-solid fa-clock"></i> ${dataInicio.toLocaleDateString('pt-BR')} ${dataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
        </div>
        <div class="event-acoes">
          <button class="btn-acoes ver" title="Ver detalhes">Ver</button>
          <button class="btn-acoes editar" title="Editar">Editar</button>
          <button class="btn-acoes excluir" title="Excluir">Excluir</button>
        </div>
      </div>
    `;
  }).join('');

  // Adicionar evento de clique nos eventos
  el.agendaList.querySelectorAll('.agenda-event').forEach(eventEl => {
    eventEl.addEventListener('click', (e) => {
      if (e.target.closest('.btn-acoes')) return;

      const eventId = eventEl.getAttribute('data-event-id');
      const event = state.agendaEvents.find(e => e.id === eventId);
      if (event) {
        state.selectedEvent = event;
        openEventDetails(event);
      }
    });
  });
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
      saveState();
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
      saveState();
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
        saveState();
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

// ==================== FORMATAÇÃO DE MENSAGENS & AGENDA ====================
function formatMarkdownWithAgendaCards(text) {
  if (!text) return '';
  try {
    const processed = text.replace(/```agenda_action\s*([\s\S]*?)```/g, (match, jsonStr) => {
      try {
        const data = JSON.parse(jsonStr);
        const isCreate = data.action === 'create';
        const isDelete = data.action === 'delete';
        const actionName = isCreate ? 'MISSÃO AGENDADA PELA IA' : (isDelete ? 'MISSÃO EXCLUÍDA PELA IA' : 'MISSÃO ATUALIZADA PELA IA');
        const icon = isCreate ? 'fa-calendar-check' : (isDelete ? 'fa-calendar-xmark' : 'fa-calendar-pen');
        const title = data.titulo || (isDelete ? `ID: ${data.id}` : 'Missão Operacional');
        const timeInfo = data.dataInicio ? new Date(data.dataInicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
        const pasta = data.pasta ? ` • Pasta: ${data.pasta}` : '';

        return `
          <div class="ia-agenda-card">
            <div class="ia-agenda-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="ia-agenda-details">
              <span class="ia-agenda-tag">${actionName}</span>
              <span class="ia-agenda-title">${escapeHtml(title)}</span>
              ${timeInfo ? `<span class="ia-agenda-meta"><i class="fa-regular fa-clock"></i> ${timeInfo}${pasta}</span>` : ''}
            </div>
          </div>
        `;
      } catch (e) {
        return match;
      }
    });

    if (window.marked && typeof window.marked.parse === 'function') {
      return marked.parse(processed);
    }
    return escapeHtml(processed);
  } catch (err) {
    console.error('Erro ao formatar mensagem:', err);
    return window.marked ? marked.parse(text) : escapeHtml(text);
  }
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
                try {
                  contentBody.innerHTML = formatMarkdownWithAgendaCards(fullResponse);
                } catch (e) {
                  contentBody.innerHTML = escapeHtml(fullResponse);
                }
                addCopyButtonsToCode(contentBody);
                el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
              } else if (parsed.agenda_updated) {
                await loadAgenda();
                notifyBanner('📅 Agenda sincronizada com nova missão da IA!');
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
    try {
      contentBody.innerHTML = formatMarkdownWithAgendaCards(fullResponse);
    } catch (e) {
      contentBody.innerHTML = escapeHtml(fullResponse);
    }
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
    try {
      renderedContent = sender === 'model' ? formatMarkdownWithAgendaCards(text) : escapeHtml(text);
    } catch (e) {
      renderedContent = sender === 'model' && window.marked ? marked.parse(text) : escapeHtml(text);
    }
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

  // Toggle Sidebar Móvel
  el.btnSidebarToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
    el.sidebar.classList.toggle('open');
    if (el.btnSidebarToggle.querySelector('i').classList.contains('fa-bars')) {
      el.btnSidebarToggle.querySelector('i').classList.remove('fa-bars');
      el.btnSidebarToggle.querySelector('i').classList.add('fa-xmark');
    } else {
      el.btnSidebarToggle.querySelector('i').classList.remove('fa-xmark');
      el.btnSidebarToggle.querySelector('i').classList.add('fa-bars');
    }
  });

  // Salvar modelo selecionado
  el.modelSelect.addEventListener('change', saveState);
  // Salvar pasta de upload selecionada
  el.selectTargetFolder.addEventListener('change', saveState);

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

  // Agenda Modal & Calendar events
  if (el.btnAgenda) {
    el.btnAgenda.addEventListener('click', () => {
      loadAgenda();
      closeEventForm();
      el.modalAgenda.classList.remove('hidden');
    });
  }

  if (el.btnCloseAgendaModal) {
    el.btnCloseAgendaModal.addEventListener('click', () => {
      el.modalAgenda.classList.add('hidden');
    });
  }

  if (el.btnCalPrev) {
    el.btnCalPrev.addEventListener('click', () => {
      state.calCurrentDate.setMonth(state.calCurrentDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (el.btnCalNext) {
    el.btnCalNext.addEventListener('click', () => {
      state.calCurrentDate.setMonth(state.calCurrentDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (el.btnCalToday) {
    el.btnCalToday.addEventListener('click', () => {
      state.calCurrentDate = new Date();
      state.calSelectedDate = new Date();
      renderCalendar();
      renderSelectedDayEvents();
      closeEventForm();
    });
  }

  if (el.btnCalCreateEvent) {
    el.btnCalCreateEvent.addEventListener('click', () => openEventForm(null));
  }

  if (el.btnQuickAddToDay) {
    el.btnQuickAddToDay.addEventListener('click', () => openEventForm(null));
  }

  if (el.btnCancelCalForm) {
    el.btnCancelCalForm.addEventListener('click', closeEventForm);
  }

  if (el.btnCancelEventBtn) {
    el.btnCancelEventBtn.addEventListener('click', closeEventForm);
  }

  if (el.calEventForm) {
    el.calEventForm.addEventListener('submit', handleEventFormSubmit);
  }

  // Save state to localStorage
  saveState();
}

// ==================== GESTÃO DA AGENDA & GOOGLE CALENDAR ====================

async function loadAgenda() {
  try {
    const res = await fetch('/api/agenda', { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    state.agendaEvents = data.eventos || [];
    renderCalendar();
    renderSelectedDayEvents();
  } catch (err) {
    console.error('Erro ao carregar agenda:', err);
  }
}

function formatDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderCalendar() {
  if (!el.calendarDaysGrid || !el.calMonthYear) return;

  const currentYear = state.calCurrentDate.getFullYear();
  const currentMonth = state.calCurrentDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  el.calMonthYear.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Domingo
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const todayKey = formatDateKey(new Date());
  const selectedKey = formatDateKey(state.calSelectedDate);

  let gridHtml = '';

  // 1. Dias do mês anterior
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevDate = new Date(currentYear, currentMonth - 1, dayNum);
    const dateKey = formatDateKey(prevDate);
    const eventsOnDay = getEventsForDate(dateKey);
    gridHtml += renderDayCell(dayNum, prevDate, dateKey, true, dateKey === todayKey, dateKey === selectedKey, eventsOnDay);
  }

  // 2. Dias do mês atual
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const cellDate = new Date(currentYear, currentMonth, day);
    const dateKey = formatDateKey(cellDate);
    const eventsOnDay = getEventsForDate(dateKey);
    gridHtml += renderDayCell(day, cellDate, dateKey, false, dateKey === todayKey, dateKey === selectedKey, eventsOnDay);
  }

  // 3. Dias do próximo mês para completar grade múltipla de 7 (35 ou 42)
  const totalCellsSoFar = firstDayOfWeek + daysInCurrentMonth;
  const targetTotal = totalCellsSoFar > 35 ? 42 : 35;
  const remaining = targetTotal - totalCellsSoFar;

  for (let nextDay = 1; nextDay <= remaining; nextDay++) {
    const nextDate = new Date(currentYear, currentMonth + 1, nextDay);
    const dateKey = formatDateKey(nextDate);
    const eventsOnDay = getEventsForDate(dateKey);
    gridHtml += renderDayCell(nextDay, nextDate, dateKey, true, dateKey === todayKey, dateKey === selectedKey, eventsOnDay);
  }

  el.calendarDaysGrid.innerHTML = gridHtml;

  // Bind click nos dias
  el.calendarDaysGrid.querySelectorAll('.cal-day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.getAttribute('data-date');
      if (dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        state.calSelectedDate = new Date(y, m - 1, d);
        if (cell.classList.contains('other-month')) {
          state.calCurrentDate = new Date(y, m - 1, 1);
        }
        renderCalendar();
        renderSelectedDayEvents();
        closeEventForm();
      }
    });
  });
}

function getEventsForDate(dateKey) {
  return state.agendaEvents.filter(e => {
    if (!e.dataInicio) return false;
    return e.dataInicio.startsWith(dateKey);
  });
}

function renderDayCell(dayNum, dateObj, dateKey, isOtherMonth, isToday, isSelected, events) {
  let eventsHtml = '';
  const maxPills = 3;
  const displayEvents = events.slice(0, maxPills);

  displayEvents.forEach(evt => {
    const prioClass = `prio-${evt.prioridade || 'normal'}`;
    const timeStr = evt.dataInicio && evt.dataInicio.length >= 16 ? evt.dataInicio.substring(11, 16) : '';
    eventsHtml += `
      <div class="cal-event-pill ${prioClass}" title="${escapeHtml(evt.titulo)} (${timeStr})">
        ${timeStr ? `<strong>${timeStr}</strong> ` : ''}${escapeHtml(evt.titulo)}
      </div>
    `;
  });

  if (events.length > maxPills) {
    eventsHtml += `<div class="cal-more-badge">+${events.length - maxPills} missões</div>`;
  }

  return `
    <div class="cal-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateKey}">
      <div class="cal-day-header-row">
        <span class="cal-day-number">${dayNum}</span>
      </div>
      <div class="cal-day-events-container">
        ${eventsHtml}
      </div>
    </div>
  `;
}

function renderSelectedDayEvents() {
  if (!el.calDayEventsList || !el.calSelectedDayTitle) return;

  const dateKey = formatDateKey(state.calSelectedDate);
  const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekday = weekdays[state.calSelectedDate.getDay()];
  const day = state.calSelectedDate.getDate();
  const monthName = monthNames[state.calSelectedDate.getMonth()];
  const year = state.calSelectedDate.getFullYear();

  el.calSelectedDayTitle.textContent = `${weekday}, ${day} de ${monthName} de ${year}`;

  const events = getEventsForDate(dateKey);

  if (events.length === 0) {
    el.calDayEventsList.innerHTML = `
      <div class="cal-empty-state">
        <i class="fa-regular fa-calendar-check"></i>
        <p>Nenhuma missão agendada neste dia.</p>
        <button id="btn-empty-add-mission" class="btn-tool-sm btn-cal-action">
          <i class="fa-solid fa-plus"></i> Agendar Missão
        </button>
      </div>
    `;
    const btnEmptyAdd = document.getElementById('btn-empty-add-mission');
    if (btnEmptyAdd) {
      btnEmptyAdd.addEventListener('click', () => openEventForm(null));
    }
    return;
  }

  el.calDayEventsList.innerHTML = events.map(evt => {
    const prio = evt.prioridade || 'normal';
    const prioLabel = prio === 'alta' ? 'Crítica' : (prio === 'media' ? 'Média' : 'Normal');
    const startStr = evt.dataInicio && evt.dataInicio.length >= 16 ? evt.dataInicio.substring(11, 16) : '--:--';
    const endStr = evt.dataFim && evt.dataFim.length >= 16 ? evt.dataFim.substring(11, 16) : '';
    const timeDisplay = endStr ? `${startStr} às ${endStr}` : startStr;

    return `
      <div class="cal-day-event-card prio-${prio}" data-event-id="${evt.id}">
        <div class="card-title-row">
          <div class="card-event-title">${escapeHtml(evt.titulo)}</div>
        </div>
        <div class="card-badge-row">
          <span class="card-time-badge"><i class="fa-regular fa-clock"></i> ${timeDisplay}</span>
          <span class="card-folder-badge"><i class="fa-solid fa-folder"></i> ${escapeHtml(evt.pasta || 'Geral')}</span>
          <span class="card-prio-badge ${prio}">${prioLabel}</span>
          ${evt.criadoPor === 'IA' ? '<span class="card-folder-badge" style="color:var(--primary);"><i class="fa-solid fa-brain"></i> IA</span>' : ''}
        </div>
        ${evt.descricao ? `<div class="card-desc">${escapeHtml(evt.descricao)}</div>` : ''}
        <div class="card-actions-row">
          <button class="btn-item-action btn-edit-mission" title="Editar Missão" data-id="${evt.id}">
            <i class="fa-regular fa-pen-to-square"></i> Editar
          </button>
          <button class="btn-item-action delete btn-delete-mission" title="Excluir Missão" data-id="${evt.id}">
            <i class="fa-regular fa-trash-can"></i> Excluir
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Bind botões editar e excluir
  el.calDayEventsList.querySelectorAll('.btn-edit-mission').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const eventToEdit = state.agendaEvents.find(ev => ev.id === id);
      if (eventToEdit) openEventForm(eventToEdit);
    });
  });

  el.calDayEventsList.querySelectorAll('.btn-delete-mission').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm('Tem certeza que deseja excluir esta missão da agenda?')) {
        await deleteAgendaEvent(id);
      }
    });
  });
}

function populateCalendarFolderSelect() {
  if (!el.calEventPasta) return;
  const folderOptions = state.folders.map(f => `<option value="${escapeHtml(f.name)}">${escapeHtml(f.name)}</option>`).join('');
  el.calEventPasta.innerHTML = `<option value="Geral">Geral</option>${folderOptions}`;
}

function formatToInputDateTime(dateObj, hour = 9, minute = 0) {
  const d = new Date(dateObj);
  d.setHours(hour, minute, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function openEventForm(eventToEdit = null) {
  populateCalendarFolderSelect();
  el.calPanelDayEvents.classList.add('hidden');
  el.calPanelForm.classList.remove('hidden');

  if (eventToEdit) {
    el.calFormTitle.textContent = 'Editar Missão';
    el.calEventId.value = eventToEdit.id;
    el.calEventTitulo.value = eventToEdit.titulo || '';
    el.calEventDescricao.value = eventToEdit.descricao || '';
    el.calEventPasta.value = eventToEdit.pasta || 'Geral';
    el.calEventPrioridade.value = eventToEdit.prioridade || 'normal';
    el.calEventInicio.value = eventToEdit.dataInicio ? eventToEdit.dataInicio.substring(0, 16) : '';
    el.calEventFim.value = eventToEdit.dataFim ? eventToEdit.dataFim.substring(0, 16) : '';
  } else {
    el.calFormTitle.textContent = 'Nova Missão Operacional';
    el.calEventId.value = '';
    el.calEventTitulo.value = '';
    el.calEventDescricao.value = '';
    el.calEventPasta.value = 'Geral';
    el.calEventPrioridade.value = 'normal';
    
    const now = new Date();
    const currentHour = now.getHours();
    const targetHour = (state.calSelectedDate.toDateString() === now.toDateString()) ? (currentHour + 1) : 9;
    
    el.calEventInicio.value = formatToInputDateTime(state.calSelectedDate, targetHour, 0);
    el.calEventFim.value = formatToInputDateTime(state.calSelectedDate, targetHour + 1, 0);
  }

  el.calEventTitulo.focus();
}

function closeEventForm() {
  if (!el.calPanelForm || !el.calPanelDayEvents) return;
  el.calPanelForm.classList.add('hidden');
  el.calPanelDayEvents.classList.remove('hidden');
}

async function handleEventFormSubmit(e) {
  e.preventDefault();
  const id = el.calEventId.value;
  const titulo = el.calEventTitulo.value.trim();
  const pasta = el.calEventPasta.value;
  const prioridade = el.calEventPrioridade.value;
  const dataInicio = el.calEventInicio.value;
  const dataFim = el.calEventFim.value;
  const descricao = el.calEventDescricao.value.trim();

  if (!titulo) {
    notifyBanner('Título da missão é obrigatório!');
    return;
  }
  if (!dataInicio) {
    notifyBanner('Data e horário de início são obrigatórios!');
    return;
  }

  const payload = { titulo, descricao, pasta, prioridade, dataInicio, dataFim };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/agenda/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/agenda', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      await loadAgenda();
      closeEventForm();
      notifyBanner(id ? 'Missão atualizada na agenda!' : 'Missão criada na agenda com sucesso!');
    } else {
      const err = await res.json();
      alert(err.error || 'Erro ao salvar evento na agenda.');
    }
  } catch (err) {
    console.error('Erro ao salvar evento:', err);
    alert('Erro de conexão ao salvar missão.');
  }
}

async function deleteAgendaEvent(id) {
  try {
    const res = await fetch(`/api/agenda/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (res.ok) {
      await loadAgenda();
      notifyBanner('Missão excluída da agenda.');
    } else {
      const err = await res.json();
      alert(err.error || 'Erro ao excluir missão.');
    }
  } catch (err) {
    console.error('Erro ao excluir evento:', err);
    alert('Erro de conexão ao excluir missão.');
  }
}

// ==================== SALVAR ESTADO ====================
function saveState() {
  localStorage.setItem('nexus_activeFiles', JSON.stringify(Array.from(state.activeFiles)));
  localStorage.setItem('nexus_currentChatId', state.currentChatId);
  localStorage.setItem('nexus_selectedModel', el.modelSelect.value);
  localStorage.setItem('nexus_uploadFolder', el.selectTargetFolder.value);
}

// Inicializa no carregamento do DOM
window.addEventListener('DOMContentLoaded', init);
