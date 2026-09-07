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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
		ThrottlerModule.forRootAsync({
			useFactory: () => {
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
					storage: new ThrottlerStorageRedisService(redis),
				};
			},
		}),
    PrismaModule,
    RedisModule,
    QueueModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TwoFactorModule,
    EmailModule,
		ScheduleModule.forRoot(), // 2. Регистрируем глобально для всего приложения!
  ],
	providers: [
		{
			provide: APP_INTERCEPTOR,
			useClass: IdempotencyInterceptor,
		}
	]
})
export class AppModule {}
