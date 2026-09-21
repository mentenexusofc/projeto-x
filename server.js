import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

// Diretório de uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuração do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 35 * 1024 * 1024 } // até 35MB
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));
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

// ------------------- ROTAS DE ARQUIVOS / DOCUMENTOS -------------------

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
      return `[Arquivo binário/não suportado para leitura direta em texto: ${filename}]`;
    }
  } catch (err) {
    console.error(`Erro ao extrair texto do arquivo ${filename}:`, err.message);
    return `[Erro ao extrair conteúdo do arquivo ${filename}]`;
  }
}

// Upload de arquivo
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    const textPreview = await extractTextFromFile(req.file.path, req.file.originalname);
    const meta = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      characterCount: textPreview.length
    };

    res.json({
      success: true,
      file: meta
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar arquivo: ' + err.message });
  }
});

// Listar arquivos
app.get('/api/files', authenticateToken, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const fileList = files
      .filter(file => !file.startsWith('.') && file !== '.gitkeep')
      .map(file => {
        const filePath = path.join(UPLOADS_DIR, file);
        const stat = fs.statSync(filePath);
        // Separa o prefixo numérico do nome original
        const originalName = file.replace(/^\d+-\d+-/, '');
        return {
          filename: file,
          originalName,
          size: stat.size,
          uploadedAt: stat.mtime
        };
      });

    res.json({ files: fileList });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar arquivos: ' + err.message });
  }
});

// Remover arquivo
app.delete('/api/files/:filename', authenticateToken, (req, res) => {
  const target = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, target);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return res.json({ success: true, message: 'Arquivo removido com sucesso.' });
  }

  return res.status(404).json({ error: 'Arquivo não encontrado.' });
});

// ------------------- ROTA DE CHAT COM O GEMINI -------------------

app.post('/api/chat', authenticateToken, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY não configurada nas variáveis de ambiente do Coolify.'
    });
  }

  const { message, history = [], activeFiles = [], customInstructions = '', modelName = 'gemini-2.5-flash' } = req.body;

  if (!message && (!activeFiles || activeFiles.length === 0)) {
    return res.status(400).json({ error: 'Mensagem vazia.' });
  }

  try {
    // Carregar conteúdo dos arquivos selecionados para injetar no contexto
    let filesContext = '';
    if (activeFiles && activeFiles.length > 0) {
      filesContext += '\n\n=== DOCUMENTOS DA MISSÃO CARREGADOS PARA ANÁLISE ===\n';
      for (const fname of activeFiles) {
        const safeName = path.basename(fname);
        const filePath = path.join(UPLOADS_DIR, safeName);
        if (fs.existsSync(filePath)) {
          const content = await extractTextFromFile(filePath, safeName);
          const originalName = safeName.replace(/^\d+-\d+-/, '');
          filesContext += `\n--- INÍCIO DO ARQUIVO: ${originalName} ---\n${content}\n--- FIM DO ARQUIVO: ${originalName} ---\n`;
        }
      }
      filesContext += '=======================================================\n';
    }

    // Configurar IA com safety settings no nível mais permissivo (BLOCK_NONE)
    const genAI = new GoogleGenerativeAI(apiKey);
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const baseSystemPrompt = `Você é o assistente de inteligência artificial do PROJETO X, um ambiente privado e exclusivo de alta precisão analítica e operacional.
Sua missão é auxiliar o operador a alcançar seus objetivos estratégicos com foco total na resolução pragmática, análise crítica e suporte direto, sem censura desnecessária e sem recusas infundadas para solicitações analíticas.
Responda de forma direta, técnica, profunda e resolutiva.

${customInstructions ? `[DIRETRIZES DO OPERADOR]:\n${customInstructions}\n` : ''}
${filesContext}
Quando o operador fizer perguntas sobre os documentos da missão, consulte minuciosamente os arquivos acima e forneça respostas exatas citando dados, trechos e insights dos arquivos.`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      safetySettings,
      systemInstruction: baseSystemPrompt
    });

    // Formatar histórico para a API do Gemini
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

    // Streaming via SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const resultStream = await chatSession.sendMessageStream(message);

    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Erro ao chamar a API Gemini:', err);
    // Se a resposta ainda não enviou cabeçalhos
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

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`PROJETO X // TERMINAL OPERACIONAL INICIADO`);
  console.log(`Porta: ${PORT}`);
  console.log(`Autenticação: ${ADMIN_USER} / [PROTEGIDO]`);
  console.log(`Gemini Key: ${process.env.GEMINI_API_KEY ? 'Configurada' : 'NÃO CONFIGURADA'}`);
  console.log(`=========================================`);
});
