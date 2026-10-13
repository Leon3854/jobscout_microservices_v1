# JobScout Microservices

Микросервисная архитектура **JobScout** — AI-платформы для поиска работы.

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs)
![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-FF6600?style=for-the-badge&logo=rabbitmq)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes)

## Что это

Полиглотная микросервисная платформа, декомпозирующая монолитный JobScout на независимые сервисы по доменам.

**Текущий статус:** реализован **Auth Service** (JWT, 2FA, OAuth) + общая инфраструктура (Postgres, Redis, RabbitMQ) и Kubernetes-манифесты. Остальные сервисы — в плане ниже.

## Архитектура

| Сервис | Стек | Ответственность | Статус |
|---|---|---|---|
| API Gateway | NestJS | единая точка входа, маршрутизация | roadmap |
| **Auth Service** | NestJS, Prisma | JWT, 2FA, OAuth | ✅ реализован |
| User Service | NestJS | профили пользователей | roadmap |
| Chat Service | Go | WebSocket-чат | roadmap |
| Job Service | Python | AI-агенты, краулеры | roadmap |

Взаимодействие — через RabbitMQ (асинхронные события) и gRPC (синхронные вызовы).

## Стек

NestJS · TypeScript · Go · Python · PostgreSQL 16 · Redis 7 · RabbitMQ 3 · Docker Compose · Kubernetes

## Быстрый старт

```bash
# 1. Клонировать
git clone https://github.com/Leon3854/jobscout_microservices_v1.git
cd jobscout_microservices_v1

# 2. Создать .env (см. services/auth-service/.env.example)

# 3. Поднять инфраструктуру + auth-service
make up
```

Команды Makefile: `make up` · `make down` · `make logs` · `make clean` · `make help`.

## Структура

```text
jobscout_microservices_v1/
├── services/
│   └── auth-service/          # NestJS: JWT, 2FA, OAuth
├── k8s/                       # Kubernetes-манифесты (namespace, configmap, secrets, HPA)
├── docker-compose.yml         # Postgres + Redis + RabbitMQ + auth-service
├── Makefile
└── README.md
```

## Roadmap

- [ ] API Gateway, User Service, Chat Service, Job Service
- [ ] Shared library (DTO / интерфейсы) и protobuf-контракты
- [ ] Terraform-модули для инфраструктуры

Полное ТЗ — в [`CODE_REVIEW_PROMPT.md`](CODE_REVIEW_PROMPT.md).
