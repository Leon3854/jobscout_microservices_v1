// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { QueueModule } from '../queue/queue.module';

/**
 * Модуль пользователей.
 * Обрабатывает регистрацию и управление пользователями.
 */
@Module({
	imports: [QueueModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}