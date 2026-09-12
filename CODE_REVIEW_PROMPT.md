Отлично! Создаю подробный промпт для следующей сессии. Скопируй команду целиком:

```bash
cd ~/Desktop/examples2025/jobscout_microservice-v1
cat > CODE_REVIEW_PROMPT.md << 'PROMPT_EOF'
# 📋 ПРОМПТ ДЛЯ СЛЕДУЮЩЕЙ СЕССИИ — КОД-РЕВЬЮ AUTH SERVICE

## 🎯 ЦЕЛЬ СЕССИИ

Провести полное код-ревью Auth Service: разобрать каждый файл сверху вниз, объяснить что делает каждая строка, найти проблемы, исправить. **НЕ разрабатывать новое, а понять существующее.**

## 📌 КОНТЕКСТ

Мы работаем над микросервисной версией JobScout. Первый сервис — **Auth Service** на Nest.js 11 + Prisma 8 + PostgreSQL 16 + Redis 7 + RabbitMQ 3.

**Стиль работы:**
- Объяснять КАЖДУЮ строку кода — что, зачем, почему
- Код-ревью каждого файла: что хорошо, что плохо, что можно улучшить
- JSDoc на русском для всех публичных методов
- Я (пользователь) задаю вопросы, ты объясняешь
- Двигаемся сверху вниз по структуре проекта
- Не перескакивать! Один файл за раз

## ✅ ЧТО СДЕЛАНО (10.09.2026)

### Инфраструктура:
- Docker Compose (PostgreSQL 16, Redis 7, RabbitMQ 3) — все работают
- **Важно:** данные в Docker, НЕ локально (локальный PostgreSQL остановлен)
- Docker Compose: `jobscout-postgres`, `jobscout-redis`, `jobscout-rabbitmq`
- Креды PostgreSQL: postgres/postgres, база `jobscout_db`
- Креды RabbitMQ: jobscout/rabbitmq_dev_password
- Порт PostgreSQL в Docker: 5432 (был конфликт с локальным, решено)

### Auth Service (все 14 задач выполнены):
1. ✅ HttpOnly Cookies + BFF (cookie-parser, SameSite=Strict, Partitioned)
2. ✅ jti + Redis Session Management (мгновенный отзыв)
3. ✅ Refresh Token Rotation + Reuse Detection
4. ✅ Argon2id (memoryCost 64MB, timeCost 3, parallelism 1)
5. ✅ Idempotency Keys (X-Idempotency-Key, TTL 24h)
6. ✅ Защита 2FA от брутфорса (3 попытки, блокировка 15 мин)
7. ✅ Transactional Outbox Pattern (таблица OutboxEvent)
8. ✅ Dead Letter Exchange + Retry (auth.dlx, exponential backoff)
9. ✅ Sliding Window Rate Limiting (Redis-backed)
10. ✅ Email Rate Limiting (1 письмо/60 сек)
11. ✅ Dockerfile (multi-stage, node:22-alpine, UID 1001)
12. ✅ Unit тесты (11 штук, все проходят)
13. ✅ JSDoc + TypeDoc
14. ✅ README.md

### Проверки:
- `npm run lint` — чисто
- `npm test` — 11 тестов проходят
- `npm run build` — успешно
- `npm run docs` — генерируется

### Что НЕ доделано:
- E2E тесты (есть, но не добиты — мок Prisma не работает)
- AES-256-GCM шифрование twoFactorSecret
- GitHub Actions CI/CD
- Prometheus Metrics
- Логирование с correlation ID
- Kubernetes — манифесты созданы, но:
  - **ПРОБЛЕМА:** `Database error while reading contract marker` — Prisma контракт не применён к базе в k8s
  - Нужно применить `npx prisma db init` внутри пода

## 📁 СТРУКТУРА ПРОЕКТА

```
jobscout_microservice-v1/
├── docker-compose.yml
├── .env
├── CODE_REVIEW_PROMPT.md
├── k8s/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── postgres.yaml
│   ├── redis.yaml
│   ├── rabbitmq.yaml
│   ├── auth-service.yaml
│   └── hpa.yaml
└── services/
    └── auth-service/
        ├── src/
        │   ├── main.ts
        │   ├── app.module.ts
        │   ├── app.controller.ts
        │   ├── app.service.ts
        │   ├── auth/
        │   │   ├── dto/
        │   │   │   ├── login.dto.ts
        │   │   │   ├── refresh-token.dto.ts
        │   │   │   ├── token-response.dto.ts
        │   │   │   └── two-factor.dto.ts
        │   │   ├── strategies/
        │   │   │   ├── jwt.strategy.ts
        │   │   │   └── jwt-refresh.strategy.ts
        │   │   ├── auth.controller.ts
        │   │   ├── auth.service.ts
        │   │   └── auth.module.ts
        │   ├── users/
        │   │   ├── dto/
        │   │   │   ├── create-user.dto.ts
        │   │   │   └── update-user.dto.ts
        │   │   ├── users.controller.ts
        │   │   ├── users.service.ts
        │   │   └── users.module.ts
        │   ├── two-factor/
        │   │   ├── two-factor.controller.ts
        │   │   ├── two-factor.service.ts
        │   │   └── two-factor.module.ts
        │   ├── email/
        │   │   ├── email.service.ts
        │   │   └── email.module.ts
        │   ├── redis/
        │   │   ├── redis.service.ts
        │   │   └── redis.module.ts
        │   ├── queue/
        │   │   ├── queue.service.ts
        │   │   ├── outbox.service.ts
        │   │   └── queue.module.ts
        │   ├── health/
        │   │   ├── health.controller.ts
        │   │   └── health.module.ts
        │   ├── prisma/
        │   │   ├── contract.prisma
        │   │   ├── contract.json
        │   │   ├── contract.d.ts
        │   │   ├── db.ts
        │   │   └── prisma.module.ts
        │   └── common/
        │       ├── decorators/
        │       │   └── is-strong-password.decorator.ts
        │       └── interceptors/
        │           └── idempotency.interceptor.ts
        ├── test/
        │   ├── app.e2e-spec.ts
        │   ├── auth.e2e-spec.ts
        │   └── jest-e2e.json
        ├── docs/ (TypeDoc)
        ├── Dockerfile
        ├── .dockerignore
        ├── README.md
        ├── typedoc.json
        ├── jest.config.js
        ├── eslint.config.mjs
        ├── tsconfig.json
        ├── nest-cli.json
        ├── package.json
        └── .env
```

## 📝 ПЛАН КОД-РЕВЬЮ (по порядку)

### ЭТАП 1: Точка входа
1. `src/main.ts` — bootstrap приложения
2. `src/app.module.ts` — корневой модуль
3. `src/app.controller.ts` + `src/app.service.ts`

### ЭТАП 2: Конфигурация
4. `src/prisma/contract.prisma` — контракт БД
5. `src/prisma/db.ts` — подключение к БД
6. `src/prisma/prisma.module.ts`
7. `src/redis/redis.service.ts` — Redis сервис
8. `src/redis/redis.module.ts`
9. `src/queue/queue.service.ts` — RabbitMQ
10. `src/queue/outbox.service.ts` — Transactional Outbox
11. `src/queue/queue.module.ts`

### ЭТАП 3: Аутентификация
12. `src/auth/dto/*.ts` — DTO
13. `src/auth/strategies/jwt.strategy.ts`
14. `src/auth/strategies/jwt-refresh.strategy.ts`
15. `src/auth/auth.service.ts` — ядро аутентификации
16. `src/auth/auth.controller.ts`
17. `src/auth/auth.module.ts`

### ЭТАП 4: Пользователи
18. `src/users/dto/create-user.dto.ts`
19. `src/users/dto/update-user.dto.ts`
20. `src/users/users.service.ts`
21. `src/users/users.controller.ts`
22. `src/users/users.module.ts`

### ЭТАП 5: 2FA
23. `src/two-factor/two-factor.service.ts`
24. `src/two-factor/two-factor.controller.ts`
25. `src/two-factor/two-factor.module.ts`

### ЭТАП 6: Email, Health, Common
26. `src/email/email.service.ts`
27. `src/email/email.module.ts`
28. `src/health/health.controller.ts`
29. `src/health/health.module.ts`
30. `src/common/decorators/is-strong-password.decorator.ts`
31. `src/common/interceptors/idempotency.interceptor.ts`

### ЭТАП 7: Инфраструктура
32. `package.json` — зависимости и скрипты
33. `tsconfig.json` — TypeScript конфигурация
34. `eslint.config.mjs` — ESLint
35. `jest.config.js` — Jest
36. `Dockerfile`
37. `.dockerignore`
38. `docker-compose.yml`
39. `k8s/*.yaml` — Kubernetes манифесты
40. `README.md`
41. `typedoc.json`

## 🔑 ВАЖНЫЕ ОСОБЕННОСТИ (грабли, на которые мы наступали)

### Prisma 8 API:
- **НЕ используй:** `findUnique`, `insert`, `returning`, `.one()`
- **Используй:** `db.orm.public.User.where({ email }).first()`
- **Создание:** `db.orm.public.User.create({ email, passwordHash, ... })` — БЕЗ `{ data: ... }`
- **Обновление:** `db.orm.public.User.update(data).where({ id })`
- **Контракт:** `src/prisma/contract.prisma` → `npx prisma contract emit` → `contract.json` + `contract.d.ts`
- **Инициализация БД:** `npx prisma db init` (НЕ `db push`, НЕ `migrate dev`)

### Имена таблиц:
- В БД: `User`, `UserProfile`, `TwoFactorCode`, `RefreshToken`, `OutboxEvent`
- В Prisma контракте: `User`, `UserProfile`, `TwoFactorCode`, `RefreshToken`, `OutboxEvent`
- В `contract.json`: модели хранятся в camelCase (`user`, `outboxEvent`)

### Проблема с OutboxEvent:
- Таблица в БД должна называться `outboxEvent` (camelCase), а не `OutboxEvent`
- Иначе Prisma не находит таблицу

### cookie-parser:
```typescript
import cookieParser from 'cookie-parser'; // НЕ import * as
app.use(cookieParser.default ? cookieParser.default() : cookieParser());
```

### argon2 в Docker:
- Требует Python для компиляции нативного модуля
- `apk add --no-cache python3 make g++`

### Node версия:
- **Node 22** (Prisma 8 требует >= 22.18)

### Docker build:
- Использовать `--legacy-peer-deps` (конфликт typedoc/typescript)

## ⚠️ ИЗВЕСТНЫЕ ПРОБЛЕМЫ

1. **k8s:** `Database error while reading contract marker` — нужно выполнить `npx prisma db init` внутри пода
2. **E2E тесты:** не работают из-за мока Prisma
3. **AES-256-GCM:** не реализовано
4. **GitHub Actions:** не настроено
5. **Prometheus:** не настроено
6. **Correlation ID:** не реализовано

## 🎨 СТИЛЬ КОД-РЕВЬЮ

Для каждого файла:
1. **Покажи содержимое файла** (я его покажу, ты комментируешь)
2. **Объясни построчно** — что делает каждая строка
3. **Отметь проблемы:**
   - 🔴 Критичные (баги, уязвимости)
   - 🟡 Средние (можно улучшить)
   - 🟢 Хорошо (что нравится)
4. **Предложи улучшения** с кодом
5. **Ответь на мои вопросы**
6. **Только потом** переходим к следующему файлу

## 🚀 КОМАНДЫ

```bash
# Запуск сервиса
cd services/auth-service && npm run start:dev

# Тесты
npm test

# Lint
npm run lint

# Build
npm run build

# Prisma 8
npx prisma contract emit
npx prisma db init

# Docker
cd ~/Desktop/examples2025/jobscout_microservice-v1
docker compose up -d postgres redis rabbitmq
docker compose build auth-service

# Kubernetes (Kind)
kubectl get pods -n jobscout
kubectl port-forward -n jobscout svc/auth-service 3001:3001
kubectl exec -it deployment/auth-service -n jobscout -- sh
```

## 📋 ПОРЯДОК РАБОТЫ В ЭТОЙ СЕССИИ

1. Начинаем с `src/main.ts`
2. Я (пользователь) показываю файл
3. Ты объясняешь, проводишь код-ревью
4. Я задаю вопросы
5. Исправляем если нужно
6. Переходим к следующему файлу
7. **НЕ перескакивать!** Один файл — одно обсуждение
8. Когда закончим все файлы — возвращаемся к k8s

## 💬 КАК Я БУДУ ПИСАТЬ

Я буду показывать файл так:
```
> cat src/main.ts
[содержимое файла]
```

И ждать твоего объяснения и ревью.

## 🎯 ФОРМАТ ОТВЕТА

После показа файла:
1. **Что это за файл** — краткое описание
2. **Построчный разбор** — что делает каждая строка
3. **Код-ревью:**
   - 🔴 Что нужно исправить
   - 🟡 Что можно улучшить
   - 🟢 Что хорошо
4. **Вопросы** — что я не понял, спрошу
5. **Готовность** — переходим к следующему файлу?

---

**НАЧИНАЕМ С `src/main.ts`. ПОКАЖИ ЕГО СОДЕРЖИМОЕ.**
PROMPT_EOF