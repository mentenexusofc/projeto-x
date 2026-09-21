import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'projeto-x-nexus-super-secret-key-2026';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'projetoX2026';

// Diretórios de uploads e dados
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

// Inicializar pastas necessárias
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Garantir pasta padrão "Geral"
const DEFAULT_FOLDER = path.join(UPLOADS_DIR, 'Geral');
if (!fs.existsSync(DEFAULT_FOLDER)) fs.mkdirSync(DEFAULT_FOLDER, { recursive: true });

// Helper para ler/salvar chats
function loadChats() {
  try {
    if (fs.existsSync(CHATS_FILE)) {
      const data = fs.readFileSync(CHATS_FILE, 'utf-8');
      return JSON.parse(data) || [];
    }
  } catch (e) {
    console.error('Erro ao ler chats:', e.message);
  }
  return [];
}

function saveChats(chats) {
  try {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2), 'utf-8');
  } catch (e) {
    console.error('Erro ao salvar chats:', e.message);
  }
}

// Configuração do Multer para upload por pasta
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let targetFolder = req.body.folder || 'Geral';
    // Sanitizar nome da pasta
    targetFolder = targetFolder.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Geral';
    const destDir = path.join(UPLOADS_DIR, targetFolder);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Autenticação
function authenticateToken(req, res, next) {
  let token = req.cookies?.session_token;
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login primeiro.' });
  }

  try {
    const verified = jwt.verify(token, SESSION_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Sessão expirada ou inválida.' });
  }
}

// ------------------- ROTAS DE AUTENTICAÇÃO -------------------

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Informe usuário e senha.' });
  }

  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SESSION_SECRET, { expiresIn: '7d' });

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      token,
      user: { username }
    });
  }

  return res.status(401).json({ error: 'Credenciais inválidas.' });
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user.username,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY)
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session_token');
  res.json({ success: true, message: 'Logout efetuado com sucesso.' });
});

// ------------------- ROTAS DE MÚLTIPLOS CHATS -------------------

// Listar todos os chats
app.get('/api/chats', authenticateToken, (req, res) => {
  const chats = loadChats();
  const list = chats.map(c => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    modelName: c.modelName || 'gemini-2.5-flash',
    messageCount: c.messages?.length || 0
  })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  res.json({ chats: list });
});

// Criar novo chat
app.post('/api/chats', authenticateToken, (req, res) => {
  const { title = 'Nova Missão', modelName = 'gemini-2.5-flash' } = req.body;
  const chats = loadChats();

  const newChat = {
    id: 'chat-' + crypto.randomUUID(),
    title: title.slice(0, 50),
    modelName,
    customInstructions: '',
    activeFiles: [],
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  chats.unshift(newChat);
  saveChats(chats);

  res.json({ success: true, chat: newChat });
});

// Obter detalhes de um chat específico
app.get('/api/chats/:id', authenticateToken, (req, res) => {
  const chats = loadChats();
  const chat = chats.find(c => c.id === req.params.id);

  if (!chat) {
    return res.status(404).json({ error: 'Conversa não encontrada.' });
  }

  res.json({ chat });
});

// Atualizar título ou configurações do chat
app.put('/api/chats/:id', authenticateToken, (req, res) => {
  const chats = loadChats();
  const index = chats.findIndex(c => c.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Conversa não encontrada.' });
  }

  const { title, customInstructions, activeFiles, modelName } = req.body;
  if (title !== undefined) chats[index].title = title.slice(0, 60);
  if (customInstructions !== undefined) chats[index].customInstructions = customInstructions;
  if (activeFiles !== undefined) chats[index].activeFiles = activeFiles;
  if (modelName !== undefined) chats[index].modelName = modelName;
  chats[index].updatedAt = new Date().toISOString();

  saveChats(chats);
  res.json({ success: true, chat: chats[index] });
});

// Excluir um chat
app.delete('/api/chats/:id', authenticateToken, (req, res) => {
  let chats = loadChats();
  const initialLength = chats.length;
  chats = chats.filter(c => c.id !== req.params.id);

  if (chats.length === initialLength) {
    return res.status(404).json({ error: 'Conversa não encontrada.' });
  }

  saveChats(chats);
  res.json({ success: true, message: 'Conversa excluída.' });
});

// ------------------- ROTAS DE PASTAS & ARQUIVOS -------------------

// Helper para ler e extrair texto
async function extractTextFromFile(filePath, filename) {
  const ext = path.extname(filename).toLowerCase();
  try {
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text || '';
    } else if (['.txt', '.md', '.csv', '.json', '.xml', '.log', '.js', '.py', '.html', '.css', '.env', '.yaml', '.yml'].includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8');
    } else {
      return `[Arquivo binário/não texto: ${filename}]`;
    }
  } catch (err) {
    console.error(`Erro ao extrair ${filename}:`, err.message);
    return `[Erro ao extrair conteúdo do arquivo ${filename}]`;
  }
}

// Listar todas as pastas e arquivos agrupados
app.get('/api/folders', authenticateToken, (req, res) => {
  try {
    const entries = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true });
    const folders = [];

    // Pastas existentes
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        const folderPath = path.join(UPLOADS_DIR, entry.name);
        const folderFiles = fs.readdirSync(folderPath, { withFileTypes: true });
        const filesList = [];

        for (const f of folderFiles) {
          if (f.isFile() && !f.name.startsWith('.') && f.name !== '.gitkeep') {
            const fPath = path.join(folderPath, f.name);
            const stat = fs.statSync(fPath);
            const originalName = f.name.replace(/^\d+-\d+-/, '');
            filesList.push({
              filename: f.name,
              originalName,
              folder: entry.name,
              size: stat.size,
              pathId: `${entry.name}/${f.name}`,
              uploadedAt: stat.mtime
            });
          }
        }

        folders.push({
          name: entry.name,
          filesCount: filesList.length,
          files: filesList
        });
      } else if (entry.isFile() && entry.name !== '.gitkeep') {
        // Arquivos na raiz de uploads são agrupados em 'Geral'
        const fPath = path.join(UPLOADS_DIR, entry.name);
        const stat = fs.statSync(fPath);
        const originalName = entry.name.replace(/^\d+-\d+-/, '');
        
        let geral = folders.find(f => f.name === 'Geral');
        if (!geral) {
          geral = { name: 'Geral', filesCount: 0, files: [] };
          folders.unshift(geral);
        }
        geral.files.push({
          filename: entry.name,
          originalName,
          folder: 'Geral',
          size: stat.size,
          pathId: entry.name,
          uploadedAt: stat.mtime
        });
        geral.filesCount = geral.files.length;
      }
    }

    // Garante que a pasta 'Geral' sempre apareça primeiro
    if (!folders.some(f => f.name === 'Geral')) {
      folders.unshift({ name: 'Geral', filesCount: 0, files: [] });
    }

    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar pastas: ' + err.message });
  }
});

// Criar nova pasta
app.post('/api/folders', authenticateToken, (req, res) => {
  let { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome da pasta obrigatório.' });

  name = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
  if (!name) return res.status(400).json({ error: 'Nome de pasta inválido.' });

  const targetPath = path.join(UPLOADS_DIR, name);
  if (fs.existsSync(targetPath)) {
    return res.status(409).json({ error: 'Já existe uma pasta com este nome.' });
  }

  try {
    fs.mkdirSync(targetPath, { recursive: true });
    res.json({ success: true, folder: { name, filesCount: 0, files: [] } });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao criar pasta: ' + e.message });
  }
});

// Excluir pasta
app.delete('/api/folders/:folderName', authenticateToken, (req, res) => {
  const folderName = req.params.folderName.trim();
  if (folderName === 'Geral') {
    return res.status(400).json({ error: 'A pasta Geral não pode ser excluída.' });
  }

  const targetPath = path.join(UPLOADS_DIR, folderName);
  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Pasta não encontrada.' });
  }

  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    res.json({ success: true, message: 'Pasta removida com sucesso.' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao excluir pasta: ' + e.message });
  }
});

// Upload de arquivos
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    const folder = req.body.folder || 'Geral';
    const textPreview = await extractTextFromFile(req.file.path, req.file.originalname);
    const meta = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      folder,
      pathId: `${folder}/${req.file.filename}`,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      characterCount: textPreview.length
    };

    res.json({ success: true, file: meta });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar arquivo: ' + err.message });
  }
});

// Mover arquivo entre pastas
app.put('/api/files/move', authenticateToken, (req, res) => {
  const { filename, sourceFolder = 'Geral', targetFolder = 'Geral' } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Nome do arquivo obrigatório.' });
  }

  const safeFile = path.basename(filename);
  let srcPath = path.join(UPLOADS_DIR, path.basename(sourceFolder), safeFile);

  // Se não estiver na pasta de origem informada, busca em todas as pastas
  if (!fs.existsSync(srcPath)) {
    const entries = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = path.join(UPLOADS_DIR, entry.name, safeFile);
        if (fs.existsSync(candidate)) {
          srcPath = candidate;
          break;
        }
      }
    }
  }

  if (!fs.existsSync(srcPath)) {
    return res.status(404).json({ error: 'Arquivo de origem não encontrado.' });
  }

  const destDir = path.join(UPLOADS_DIR, path.basename(targetFolder));
  const destPath = path.join(destDir, safeFile);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    fs.renameSync(srcPath, destPath);
    res.json({
      success: true,
      newPathId: `${path.basename(targetFolder)}/${safeFile}`,
      folder: path.basename(targetFolder)
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao mover arquivo: ' + e.message });
  }
});

// Excluir arquivo
app.delete('/api/files', authenticateToken, (req, res) => {
  const { pathId } = req.query;
  if (!pathId) return res.status(400).json({ error: 'pathId obrigatório.' });

  const safeFile = path.basename(pathId);
  const parts = pathId.split('/');
  let targetPath = parts.length > 1 
    ? path.join(UPLOADS_DIR, path.basename(parts[0]), safeFile)
    : path.join(UPLOADS_DIR, safeFile);

  // Se não encontrar direto, procura recursivamente em subpastas
  if (!fs.existsSync(targetPath)) {
    const entries = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = path.join(UPLOADS_DIR, entry.name, safeFile);
        if (fs.existsSync(candidate)) {
          targetPath = candidate;
          break;
        }
      }
    }
  }

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return res.json({ success: true, message: 'Arquivo excluído com sucesso.' });
  }

  return res.status(404).json({ error: 'Arquivo não encontrado.' });
});

// ------------------- ROTA DE CHAT COM GEMINI -------------------

app.post('/api/chat', authenticateToken, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'CONFIGURE_SUA_CHAVE_AQUI') {
    return res.status(500).json({
      error: 'GEMINI_API_KEY não configurada. Defina sua chave de API nas variáveis do Coolify ou no arquivo .env.'
    });
  }

  const { 
    chatId,
    message, 
    history = [], 
    activeFiles = [], 
    customInstructions = '', 
    modelName = 'gemini-2.5-flash' 
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Mensagem vazia.' });
  }

  try {
    // Carregar arquivos ativos em pastas para injetar contexto
    let filesContext = '';
    if (activeFiles && activeFiles.length > 0) {
      filesContext += '\n\n=== DOCUMENTOS E PASTAS DE INTELIGÊNCIA DA MISSÃO ===\n';
      for (const pId of activeFiles) {
        const parts = pId.split('/');
        let filePath = parts.length > 1
          ? path.join(UPLOADS_DIR, path.basename(parts[0]), path.basename(parts[1]))
          : path.join(UPLOADS_DIR, path.basename(parts[0]));

        // Tenta também procurar na subpasta Geral caso o path venha direto
        if (!fs.existsSync(filePath)) {
          filePath = path.join(UPLOADS_DIR, 'Geral', path.basename(pId));
        }

        if (fs.existsSync(filePath)) {
          const content = await extractTextFromFile(filePath, path.basename(filePath));
          const originalName = path.basename(filePath).replace(/^\d+-\d+-/, '');
          const folderName = parts.length > 1 ? parts[0] : 'Geral';
          filesContext += `\n--- [PASTA: ${folderName}] ARQUIVO: ${originalName} ---\n${content}\n--- FIM DO ARQUIVO: ${originalName} ---\n`;
        }
      }
      filesContext += '=======================================================\n';
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const baseSystemPrompt = `Você é a inteligência artificial tática e analítica do PROJETO X, um ambiente confidencial e operacional de alta resolução.
Seu objetivo é dar suporte irrestrito, pragmático e aprofundado ao operador em todas as suas missões estratégicas.
Responda de forma ágil, detalhada, sem recusas vazias e com precisão analítica.

${customInstructions ? `[DIRETRIZES ESPECÍFICAS DESTA MISSÃO]:\n${customInstructions}\n` : ''}
${filesContext}
Sempre que o operador questionar sobre dados, relatórios ou informações dos documentos carregados acima, cite minuciosamente as evidências, números e conclusões presentes neles.`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      safetySettings,
      systemInstruction: baseSystemPrompt
    });

    // Formatar histórico para a API
    const formattedHistory = [];
    for (const item of history) {
      if (item.role === 'user' || item.role === 'model') {
        formattedHistory.push({
          role: item.role,
          parts: [{ text: item.content || '' }]
        });
      }
    }

    const chatSession = model.startChat({
      history: formattedHistory
    });

    // Preparar streaming SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const resultStream = await chatSession.sendMessageStream(message);
    let fullResponse = '';

    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }

    // Se tiver chatId, salvar as mensagens no backend
    if (chatId) {
      try {
        const chats = loadChats();
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
          if (!chat.messages) chat.messages = [];
          chat.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
          });
          chat.messages.push({
            role: 'model',
            content: fullResponse,
            timestamp: new Date().toISOString()
          });
          // Se for o primeiro prompt, usa como título inicial
          if (chat.title === 'Nova Missão' && chat.messages.length <= 2) {
            chat.title = message.slice(0, 36) + (message.length > 36 ? '...' : '');
          }
          chat.updatedAt = new Date().toISOString();
          saveChats(chats);
        }
      } catch (saveErr) {
        console.warn('Erro ao salvar histórico do chat:', saveErr.message);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Erro na API Gemini:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Erro na comunicação com Gemini: ' + (err.message || 'Falha desconhecida.')
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`PROJETO X // MÚLTIPLOS CHATS & PASTAS ATIVO`);
  console.log(`Porta: ${PORT}`);
  console.log(`=========================================`);
});
