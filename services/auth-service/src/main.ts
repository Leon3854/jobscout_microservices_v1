// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Инициализация и запуск Nest.js приложения.
 * Настраивает безопасность, CORS, валидацию, Swagger и cookie-parser.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Security: Helmet для HTTP заголовков безопасности
  app.use(helmet());

  // Compression: Сжатие ответов
  app.use(compression());

  // Cookie parser: Парсинг cookies из запросов
  app.use(cookieParser());

  // CORS: Настройка Cross-Origin Resource Sharing
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      process.env.FRONTEND_URL || 'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  });

  // Validation: Глобальная валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix: Все эндпоинты будут начинаться с /api/v1
  app.setGlobalPrefix('api/v1');

  // Swagger: Документация API (только в dev-режиме)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('JobScout Auth Service')
      .setDescription('Authentication service with JWT, 2FA, OAuth')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('access_token', {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
      })
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Auth Service running on port ${port}`);
}

bootstrap();
