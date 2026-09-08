# services/auth-service/Dockerfile

# ============ BUILD STAGE ============
FROM node:22-alpine AS build

# Устанавливаем Python и build tools для argon2
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем все зависимости
RUN npm ci --legacy-peer-deps

# Копируем исходный код
COPY . .

# Генерируем Prisma контракт
RUN npx prisma contract emit

# Собираем приложение
RUN npm run build

# ============ PRODUCTION STAGE ============
FROM node:22-alpine AS production

# Устанавливаем Python для argon2 (если нужен на runtime)
RUN apk add --no-cache python3

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Копируем package.json
COPY package*.json ./

# Устанавливаем production зависимости
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Копируем собранное приложение
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/prisma/contract.json ./src/prisma/contract.json
COPY --from=build /app/src/prisma/contract.d.ts ./src/prisma/contract.d.ts
COPY --from=build /app/src/prisma/contract.prisma ./src/prisma/contract.prisma

# Копируем .env
COPY .env ./

# Переключаемся на непривилегированного пользователя
USER nestjs

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/v1/health').then(r=>r.json()).then(d=>process.exit(d.status==='ok'?0:1)).catch(()=>process.exit(1))"

# Открываем порт
EXPOSE 3001

# Запускаем
CMD ["node", "dist/main.js"]