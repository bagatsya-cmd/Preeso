FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies layer (cached separately from source)
COPY package*.json ./
RUN npm ci --only=production

# Source
COPY . .

# ── Runtime ────────────────────────────────────────────────────────────────────
EXPOSE 5000
ENV NODE_ENV=production

# Healthcheck for Docker / docker-compose
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

CMD ["node", "server.js"]
