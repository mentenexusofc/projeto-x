FROM node:22-alpine

WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm install --omit=dev

# Copiar código-fonte
COPY . .

# Criar pasta de uploads e permissões
RUN mkdir -p uploads

# Expor porta
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
