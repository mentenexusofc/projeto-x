// ==================== ESTADO DA APLICAÇÃO ====================
const state = {
  token: localStorage.getItem('nexus_token') || null,
  user: null,
  files: [],
  activeFiles: new Set(),
  chatHistory: [],
  isGenerating: false,
  systemDirectives: localStorage.getItem('nexus_directives') || ''
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

  // Sidebar / Files
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  uploadProgress: document.getElementById('upload-progress'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  filesList: document.getElementById('files-list'),
  btnRefreshFiles: document.getElementById('btn-refresh-files'),
  activeFilesCount: document.getElementById('active-files-count'),
  activeContextBar: document.getElementById('active-context-bar'),
  contextSummaryText: document.getElementById('context-summary-text'),

  // Chat
  chatMessages: document.getElementById('chat-messages'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  btnSend: document.getElementById('btn-send'),
  btnClearChat: document.getElementById('btn-clear-chat'),
  chatStatusText: document.getElementById('chat-status-text'),

  // Directives Modal
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
      loadFiles();
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

// ==================== EVENTOS ====================
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
        loadFiles();
      } else {
        el.loginAlert.textContent = data.error || 'Credenciais inválidas.';
        el.loginAlert.classList.remove('hidden');
      }
    } catch (err) {
      el.loginAlert.textContent = 'Erro ao conectar ao servidor.';
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

  // Modal de Diretrizes
  el.btnMissionDirectives.addEventListener('click', () => {
    el.customInstructions.value = state.systemDirectives;
    el.modalDirectives.classList.remove('hidden');
  });

  el.btnCloseModal.addEventListener('click', () => {
    el.modalDirectives.classList.add('hidden');
  });

  el.btnSaveDirectives.addEventListener('click', () => {
    state.systemDirectives = el.customInstructions.value.trim();
    localStorage.setItem('nexus_directives', state.systemDirectives);
    el.modalDirectives.classList.add('hidden');
    notifyContextChange('Diretrizes salvas com sucesso!');
  });

  el.btnResetDirectives.addEventListener('click', () => {
    el.customInstructions.value = '';
    state.systemDirectives = '';
    localStorage.removeItem('nexus_directives');
    el.modalDirectives.classList.add('hidden');
  });

  // Auto-resize do textarea e envio por Enter
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

  // Envio de mensagem
  el.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Limpar chat
  el.btnClearChat.addEventListener('click', () => {
    state.chatHistory = [];
    el.chatMessages.innerHTML = `
      <div class="welcome-hero">
        <div class="hero-icon">
          <i class="fa-solid fa-crosshairs"></i>
        </div>
        <h2>CENTRAL OPERACIONAL PRONTA</h2>
        <p>Terminal reiniciado. Envie novos comandos ou pergunte sobre os arquivos carregados.</p>
      </div>
    `;
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

  el.btnRefreshFiles.addEventListener('click', loadFiles);

  // Quick Prompts delegados
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

// ==================== GESTÃO DE ARQUIVOS ====================
async function loadFiles() {
  try {
    const res = await fetch('/api/files', {
      headers: getAuthHeaders()
    });

    if (!res.ok) return;

    const data = await res.json();
    state.files = data.files || [];

    // Por padrão, se forem novos arquivos, adiciona todos ao activeFiles
    state.files.forEach(f => {
      if (!state.activeFiles.has(f.filename)) {
        state.activeFiles.add(f.filename);
      }
    });

    renderFilesList();
    updateContextSummary();
  } catch (err) {
    console.error('Falha ao carregar lista de arquivos:', err);
  }
}

function renderFilesList() {
  if (state.files.length === 0) {
    el.filesList.innerHTML = `
      <div class="empty-state-files">
        <i class="fa-regular fa-file-lines"></i>
        <p>Nenhum documento carregado.</p>
      </div>
    `;
    el.activeFilesCount.textContent = '0';
    return;
  }

  el.activeFilesCount.textContent = state.activeFiles.size;

  el.filesList.innerHTML = state.files.map(file => {
    const isActive = state.activeFiles.has(file.filename);
    const sizeKb = (file.size / 1024).toFixed(1);
    const fileIcon = getFileIconClass(file.originalName);

    return `
      <div class="file-item ${isActive ? 'active' : ''}" data-file="${file.filename}">
        <input type="checkbox" class="file-checkbox" ${isActive ? 'checked' : ''} title="Incluir na IA">
        <i class="${fileIcon} file-icon"></i>
        <div class="file-details">
          <div class="file-name" title="${file.originalName}">${file.originalName}</div>
          <div class="file-meta">${sizeKb} KB</div>
        </div>
        <button class="file-delete-btn" title="Excluir arquivo">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');

  // Vincular eventos dos itens
  el.filesList.querySelectorAll('.file-item').forEach(item => {
    const filename = item.getAttribute('data-file');
    const checkbox = item.querySelector('.file-checkbox');
    const deleteBtn = item.querySelector('.file-delete-btn');

    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.activeFiles.add(filename);
        item.classList.add('active');
      } else {
        state.activeFiles.delete(filename);
        item.classList.remove('active');
      }
      el.activeFilesCount.textContent = state.activeFiles.size;
      updateContextSummary();
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFile(filename);
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

async function handleFileUpload(fileList) {
  el.uploadProgress.classList.remove('hidden');
  el.progressBarFill.style.width = '10%';

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const headers = {};
      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        state.activeFiles.add(data.file.filename);
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
    loadFiles();
  }, 400);
}

async function deleteFile(filename) {
  if (!confirm('Deseja realmente remover este arquivo da missão?')) return;

  try {
    const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (res.ok) {
      state.activeFiles.delete(filename);
      loadFiles();
    }
  } catch (err) {
    console.error('Falha ao remover arquivo:', err);
  }
}

function updateContextSummary() {
  const count = state.activeFiles.size;
  if (count > 0) {
    el.activeContextBar.classList.remove('hidden');
    el.contextSummaryText.textContent = `${count} documento(s) ativo(s) no raciocínio da IA`;
  } else {
    el.activeContextBar.classList.add('hidden');
  }
}

function notifyContextChange(msg) {
  // Notificação visual breve
  const div = document.createElement('div');
  div.className = 'context-bar';
  div.style.position = 'fixed';
  div.style.bottom = '20px';
  div.style.right = '20px';
  div.style.zIndex = '9999';
  div.innerHTML = `<div class="context-info"><i class="fa-solid fa-circle-check"></i> ${msg}</div>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

// ==================== CHAT & STREAMING ====================
async function sendMessage() {
  const message = el.chatInput.value.trim();
  if (!message || state.isGenerating) return;

  // Limpa input
  el.chatInput.value = '';
  el.chatInput.style.height = 'auto';

  // Remove hero se estiver visível
  const hero = el.chatMessages.querySelector('.welcome-hero');
  if (hero) hero.remove();

  // Adiciona mensagem do usuário
  appendMessage('user', message);
  state.chatHistory.push({ role: 'user', content: message });

  // Cria bolha de resposta da IA
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
        message,
        history: state.chatHistory.slice(-10), // Envia últimas interações para contexto contínuo
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
      buffer = lines.pop(); // Guarda a linha incompleta

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
              console.warn('Erro ao decodificar chunk SSE:', e);
            }
          }
        }
      }
    }

    contentBody.classList.remove('typing-cursor');
    state.chatHistory.push({ role: 'model', content: fullResponse });

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

// Inicia aplicação
window.addEventListener('DOMContentLoaded', init);
