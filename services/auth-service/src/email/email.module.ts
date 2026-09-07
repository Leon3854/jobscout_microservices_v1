// src/email/email.module.ts
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { RedisModule } from '../redis/redis.module';

/**
 * Модуль email.
 * Предоставляет EmailService с rate limiting.
 */
@Module({
  imports: [RedisModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}