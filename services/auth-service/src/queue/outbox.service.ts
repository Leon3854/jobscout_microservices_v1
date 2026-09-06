import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db } from '../prisma/db';
import { QueueService } from './queue.service';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly queueService: QueueService) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    await this.processPendingEvents();
  }

  async addEvent(eventType: string, payload: any): Promise<void> {
    try {
      this.logger.log(`Adding event: ${eventType}`);
      
      // В Prisma 8 Runtime данные передаются БЕЗ обёртки data!
      await db.orm.public.OutboxEvent.create({
        eventType,
        payload,
        status: 'pending',
        retryCount: 0,
      });
      
      this.logger.log(`Event added to outbox: ${eventType}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add event to outbox: ${errorMessage}`);
      throw error;
    }
  }

  async processPendingEvents(): Promise<void> {
    // 1. Находим первое pending событие
    const pendingEvent = await db.orm.public.OutboxEvent.where({
      status: 'pending',
    }).first();

    if (!pendingEvent) {
      return;
    }

    this.logger.debug(`Processing event: ${pendingEvent.id}`);
    try {
      // 2. Отправляем в RabbitMQ
      await this.queueService.publish(pendingEvent.eventType, pendingEvent.payload);
      
      // 3. НОВЫЙ ВАРИАНТ: Сначала фильтруем по ID, затем накатываем .update()
      await db.orm.public.OutboxEvent.where({ id: pendingEvent.id }).update({
        status: 'sent',
      });
      
      this.logger.log(`Event sent: ${pendingEvent.eventType} (${pendingEvent.id})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send event ${pendingEvent.id}: ${errorMessage}`);
      
      const newRetryCount = (pendingEvent.retryCount || 0) + 1;
      
      if (newRetryCount >= 5) {
        // При превышении попыток
        await db.orm.public.OutboxEvent.where({ id: pendingEvent.id }).update({
          status: 'failed',
          retryCount: newRetryCount,
        });
        this.logger.error(`Event ${pendingEvent.id} marked as failed after 5 attempts`);
      } else {
        // Просто инкрементируем счетчик
        await db.orm.public.OutboxEvent.where({ id: pendingEvent.id }).update({
          retryCount: newRetryCount,
        });
      }
    }
  }









}