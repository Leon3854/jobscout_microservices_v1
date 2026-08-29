# ============================================
# JobScout Auth Service - Dockerfile
# ============================================

# ---------- Build Stage ----------
FROM node:20-alpine AS build

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходники
COPY . .

# Генерируем Prisma client
RUN npx prisma generate

# Собираем приложение
RUN npm run build

# ---------- Production Stage ----------
FROM node:20-alpine AS production

WORKDIR /app

# Создаём непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Копируем package.json
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем собранное приложение
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/prisma ./src/prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

# Копируем .env.example как шаблон
COPY .env.example ./.env.example

# Переключаемся на непривилегированного пользователя
USER nestjs

# Открываем порт
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Запускаем приложение
CMD ["node", "dist/main.js"]
