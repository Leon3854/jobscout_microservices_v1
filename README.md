# jobscout_microservices_v1

Микросервисная архитектура JobScout - AI-платформы для поиска работы.


## Архитектура

- **API Gateway** (Nest.js) - входная точка
- **Auth Service** (Nest.js) - JWT, 2FA, OAuth
- **User Service** (Nest.js) - профили пользователей
- **Chat Service** (Go) - WebSocket чат
- **Job Service** (Python) - AI-агенты, краулеры

## Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone https://github.com/yourusername/jobscout-microservices.git

# 2. Создать .env из .env.example
cp .env.example .env
# Отредактировать .env

# 3. Запустить инфраструктуру
make up

# 4. Запустить сервисы (см. документацию в services/)
```

## Структура Проекта
```text
jobscout-microservices/
├── docker-compose.yml              # Все сервисы
├── .env                            # Секреты
├── .gitignore
├── README.md                       # Документация
├── Makefile                        # Команды сборки
├── services/
│   ├── api-gateway/                # Nest.js
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── routes/
│   │   │   └── middleware/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   ├── auth-service/               # Nest.js
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   └── strategies/
│   │   │   │       ├── jwt.strategy.ts
│   │   │   │       └── oauth.strategy.ts
│   │   │   ├── 2fa/
│   │   │   └── entities/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   ├── user-service/               # Nest.js
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── users/
│   │   │   └── entities/
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── chat-service/               # Go
│   │   ├── main.go
│   │   ├── go.mod
│   │   ├── internal/
│   │   │   ├── websocket/
│   │   │   ├── handler/
│   │   │   └── repository/
│   │   └── Dockerfile
│   └── job-service/                # Python
│       ├── main.py
│       ├── requirements.txt
│       ├── agents/
│       │   ├── hr_agents/
│       │   └── crawlers/
│       └── Dockerfile
├── libs/
│   ├── shared/                     # Общие DTO, интерфейсы
│   │   ├── src/
│   │   │   ├── interfaces/
│   │   │   ├── dtos/
│   │   │   └── utils/
│   │   └── package.json
│   └── protos/                     # gRPC/Protobuf схемы
│       ├── auth.proto
│       ├── user.proto
│       ├── chat.proto
│       └── job.proto
├── infra/
│   ├── terraform/                  # Инфраструктура
│   │   ├── modules/
│   │   │   ├── network/
│   │   │   ├── kubernetes/
│   │   │   └── database/
│   │   ├── envs/
│   │   │   ├── dev/
│   │   │   └── prod/
│   │   └── main.tf
│   └── k8s/                        # Kubernetes манифесты
│       ├── api-gateway.yaml
│       ├── auth-service.yaml
│       ├── user-service.yaml
│       ├── chat-service.yaml
│       └── job-service.yaml
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml
│   ├── grafana/
│   │   └── dashboards/
│   └── loki/
│       └── loki-config.yml
└── docs/
    ├── architecture.md
    ├── api.md
    ├── deployment.md
    └── development.md
```
