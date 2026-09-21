# PROJETO X // Terminal Privado de Operações & Inteligência

Interface web moderna e segura para conversação estratégica com o Google Gemini, com leitura de documentos e dados contextuais (PDF, TXT, MD, CSV, JSON), protegida por autenticação configurada via variáveis de ambiente.

---

## 🚀 Recursos Principais

- **Autenticação Segura:** Login baseado em `ADMIN_USER` e `ADMIN_PASSWORD` definidos nas variáveis de ambiente do Coolify / `.env`.
- **Integração com Gemini AI:** Suporte a modelos como `Gemini 2.5 Flash`, `Gemini 1.5 Pro` e `Gemini 1.5 Flash` com respostas transmitidas em tempo real via streaming (SSE).
- **Parâmetros Desbloqueados:** Safety settings ajustadas no nível mais permissivo permitido pela API oficial (`BLOCK_NONE`) para análise irrestrita de dados e documentos.
- **Dossiês da Missão (Upload de Arquivos):** Envio e extração automática de texto de arquivos (`.pdf`, `.txt`, `.md`, `.csv`, `.json`, `.js`, `.py`, etc.) para injeção direta no contexto analítico do Gemini.
- **Diretrizes Customizáveis:** Painel para definir o objetivo operacional e instruções prioritárias de sistema da IA a qualquer momento.
- **Design Exclusivo:** Estética executiva/cyberpunk em Dark Mode, com realce de sintaxe de código, botão de cópia com 1 clique e renderização rica de Markdown.
- **Pronto para Coolify:** Acompanha `Dockerfile` otimizado para deploy instantâneo em containers.

---

## ⚙️ Variáveis de Ambiente

Configure as seguintes variáveis no painel do **Coolify** (na aba *Environment Variables* da sua aplicação):

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `ADMIN_USER` | Usuário para login no terminal | `admin` |
| `ADMIN_PASSWORD` | Senha de acesso ao terminal | `sua_senha_secreta_aqui` |
| `SESSION_SECRET` | Chave para assinatura de sessões/JWT | `qualquer_sequencia_aleatoria_longa` |
| `GEMINI_API_KEY` | Chave de API do Google AI Studio | `AIzaSy...` |
| `PORT` | Porta do servidor interno | `3000` |
| `NODE_ENV` | Modo de execução | `production` |

> Obtenha sua chave gratuita do Gemini em: [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## 🐳 Como Fazer o Deploy no Coolify

1. No painel do seu Coolify em `https://coolify.mentenexus.tech`:
2. Acesse o projeto **Projeto X** (`bjp5f3vgcsyir9zlslmyerix`).
3. Adicione uma nova aplicação selecionando seu repositório Git (ou Dockerfile).
4. O Coolify detectará automaticamente o arquivo `Dockerfile` na raiz.
5. Adicione as variáveis de ambiente acima na aba **Environment Variables**.
6. Clique em **Deploy**!

---

## 💻 Como Rodar Localmente

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Crie o arquivo `.env` baseado no `.env.example`:
   ```bash
   copy .env.example .env
   ```

3. Inicie o servidor:
   ```bash
   npm start
   ```

4. Acesse: `http://localhost:3000`
