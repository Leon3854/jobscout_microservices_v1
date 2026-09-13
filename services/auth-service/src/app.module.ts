import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { EmailModule } from './email/email.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

/**
 * Корневой модуль приложения JobScout Auth Service.
 *
 * @class AppModule
 * @description
 * Собирает все модули приложения в единое дерево зависимостей.
 * Отвечает за:
 * - Подключение инфраструктурных модулей (Prisma, Redis, Queue)
 * - Настройку конфигурации (`ConfigModule`)
 * - Настройку rate limiting (`ThrottlerModule` с Redis)
 * - Регистрацию глобальных интерцепторов (`IdempotencyInterceptor`)
 * - Регистрацию планировщика задач (`ScheduleModule`)
 *
 * @example
 * ```typescript
 * // main.ts
 * const app = await NestFactory.create(AppModule);
 * ```
 */
@Module({
	/**
   * Импортируемые модули.
   * Порядок важен: конфиг и инфраструктура идут первыми.
   */
  imports: [
		/**
     * ConfigModule — глобальный доступ к `.env` через `process.env`.
     * `isGlobal: true` означает, что не нужно импортировать в каждом модуле.
     */
    ConfigModule.forRoot({
      isGlobal: true,
    }),
		/**
     * ThrottlerModule — rate limiting через Redis (Sliding Window).
     *
     * Настроены три уровня throttling:
     * - `global` — 100 запросов / 60 сек (общий лимит по IP)
     * - `login` — 5 попыток / 15 минут (защита от брутфорса логина)
     * - `email` — 1 письмо / 60 сек (защита от спама email)
     *
     * Использует `@nest-lab/throttler-storage-redis` для распределённого
     * хранения счётчиков в Redis (работает в кластере).
     */
		ThrottlerModule.forRootAsync({
			/**
     * Фабрика для создания конфигурации throttler.
     * Использует Redis для хранения счётчиков.
     */
			useFactory: () => {
				/**
     * Создаём Redis клиент для подключения к Redis.
     * Используется `process.env.REDIS_HOST` и `process.env.REDIS_PORT`
     * или используются значения по умолчанию.
     */
			/**
     * Создаём Redis клиент для подключения к Redis.
     * Используется `process.env.REDIS_HOST` и `process.env.REDIS_PORT`
     * или используются значения по умолчанию.
     */
				const redis = new Redis({
					host: process.env.REDIS_HOST || 'localhost',
					port: parseInt(process.env.REDIS_PORT || '6379'),
				});
		
				return {
					throttlers: [
						{
							name: 'global',
							ttl: 60000, // 60 секунд
							limit: 100, // 100 запросов в минуту
						},
						{
							name: 'login',
							ttl: 900000, // 15 минут
							limit: 5, // 5 попыток логина
						},
						{
							name: 'email',
							ttl: 60000, // 60 секунд
							limit: 1, // 1 письмо в минуту
						},
					],
					// Redis storage для распределённого throttling
					storage: new ThrottlerStorageRedisService(redis),
				};
			},
		}),
		/** PrismaModule — контрактный ORM-клиент (PostgreSQL). */
    PrismaModule,
		/** RedisModule — RedisService для кэша, сессий, rate limiting. RedisModule — RedisService для кэша, сессий, rate limiting.*/
    RedisModule,
		/** QueueModule — для асинхронных задач (email, notifications). email queue, notification queue. QueueModule — RabbitMQ + Transactional Outbox.*/
    QueueModule,
		/** HealthModule — для мониторинга состояния приложения. HealthModule — `/api/v1/health` для мониторинга. health check, readiness check, liveness check.*/
    HealthModule,
		/** AuthModule — для аутентификации и авторизации пользователей. аутентификация, JWT, сессии, refresh tokens.*/
    AuthModule,
		/** UsersModule — для управления пользователями. CRUD пользователей, регистрация, обновление, удаление.*/
    UsersModule,
		/** TwoFactorModule — для двухфакторной аутентификации. TOTP (2FA) с защитой от брутфорса. */
    TwoFactorModule,
		/** EmailModule — отправка email с rate limiting. */
    EmailModule,
		/** ScheduleModule — для планирования задач. */
		/**
     * ScheduleModule — планировщик задач (`@Cron`, `@Interval`).
     * Глобальная регистрация для всего приложения.
     */
		ScheduleModule.forRoot(),
  ],
	/**
   * Глобальные провайдеры.
   */
	providers: [
		/**
     * IdempotencyInterceptor — защита от повторных запросов.
     *
     * Читает заголовок `X-Idempotency-Key`, проверяет Redis:
     * - если ключ уже есть → возвращает сохранённый ответ
     * - если нет → выполняет запрос и кэширует ответ на 24 часа
     *
     * Регистрируется как `APP_INTERCEPTOR` — применяется ко всем
     * HTTP-запросам глобально.
     */
		{
			provide: APP_INTERCEPTOR,
			useClass: IdempotencyInterceptor,
		}
	]
})
export class AppModule {}
