// src/queue/queue.module.ts
import { Module, Global } from '@nestjs/common';
import { QueueService } from './queue.service';
import { OutboxService } from './outbox.service';

/**
 * Модуль очередей.
 * Предоставляет QueueService для RabbitMQ и OutboxService для Transactional Outbox.
 */
@Global()
@Module({
  providers: [QueueService, OutboxService],
  exports: [QueueService, OutboxService],
})
export class QueueModule {}