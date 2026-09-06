// src/queue/queue.service.ts
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';

/**
 * Сервис очередей RabbitMQ.
 * Поддерживает Dead Letter Exchange и Retry с экспоненциальной задержкой.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private connection!: amqp.ChannelModel;
  private channel!: amqp.Channel;
  private connected = false;
  private readonly logger = new Logger(QueueService.name);

  // Конфигурация DLX
  private readonly DLX = 'auth.dlx';
  private readonly DLQ = 'user.created.dlq';
  private readonly RETRY_QUEUE = 'user.created.retry';

// src/queue/queue.service.ts

async connect(): Promise<void> {
  if (this.connected) return;

  try {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    
    // Внедряем heartbeat
    this.connection = await amqp.connect(url, {
      heartbeat: 30, 
    });
    this.channel = await this.connection.createChannel();
    this.connected = true;
    this.logger.log('RabbitMQ connected successfully');
    
    // Настраиваем DLX
    await this.setupDeadLetterExchange();

    // ОБРАБОТЧИКИ С АВТО-РЕКОННЕКТОМ:
    this.connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed. Trying to reconnect in 5 seconds...');
      this.connected = false;
      // Через 5 секунд автоматически вызываем connect() снова!
      setTimeout(() => this.connect(), 5000); 
    });

    this.connection.on('error', (error: any) => {
      this.logger.error(`RabbitMQ connection error: ${error.message}`);
      this.connected = false;
    });

  } catch (error: any) {
    this.logger.error(`RabbitMQ connection failed: ${error.message}`);
    this.connected = false;
    
    // Если брокер еще не поднялся при старте, пробуем снова через 5 секунд вместо падения приложения
    setTimeout(() => this.connect(), 5000);
  }
}


  /**
   * Настройка Dead Letter Exchange.
   * Создает DLX, DLQ и retry очередь.
   */
  private async setupDeadLetterExchange(): Promise<void> {
    // Создаем Dead Letter Exchange
    await this.channel.assertExchange(this.DLX, 'direct', { durable: true });
    
    // Создаем Dead Letter Queue
    await this.channel.assertQueue(this.DLQ, { durable: true });
    await this.channel.bindQueue(this.DLQ, this.DLX, 'user.created');
    
    // Создаем retry очередь с TTL
    await this.channel.assertQueue(this.RETRY_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '', // default exchange
        'x-dead-letter-routing-key': 'user.created',
        'x-message-ttl': 5000, // 5 секунд
      },
    });
    
    this.logger.log('Dead Letter Exchange configured');
  }

  /**
   * Публикация сообщения в очередь.
   * @param queue - Название очереди
   * @param message - Сообщение
   * @param options - Опции публикации
   */
  async publish(
    queue: string,
    message: any,
    options?: amqp.Options.Publish,
  ): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    await this.channel.assertQueue(queue, { 
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.DLX,
        'x-dead-letter-routing-key': queue,
      },
    });
    
    const buffer = Buffer.from(JSON.stringify(message));

    this.channel.sendToQueue(queue, buffer, {
      persistent: true,
      ...options,
    });

    this.logger.debug(`Message published to ${queue}`);
  }

  /**
   * Подписка на очередь с обработкой сообщений.
   * @param queue - Название очереди
   * @param handler - Обработчик сообщений
   */
  async subscribe(
    queue: string,
    handler: (message: any) => Promise<void>,
  ): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    await this.channel.assertQueue(queue, { 
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.DLX,
        'x-dead-letter-routing-key': queue,
      },
    });

    this.channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          this.channel.ack(msg);
          this.logger.debug(`Message processed from ${queue}`);
        } catch (error: any) {
          this.logger.error(`Error processing message from ${queue}: ${error.message}`);
          
          // Получаем счетчик попыток
          const retryCount = msg.properties.headers?.['x-retry-count'] || 0;
          
          if (retryCount >= 5) {
            // Отправляем в DLQ
            this.channel.nack(msg, false, false);
            this.logger.error(`Message moved to DLQ after ${retryCount} retries`);
          } else {
            // Отправляем в retry очередь с увеличенным счетчиком
            const retryDelay = this.getRetryDelay(retryCount + 1);
            
            await this.channel.publish('', this.RETRY_QUEUE, msg.content, {
              persistent: true,
              headers: {
                'x-retry-count': retryCount + 1,
                'x-original-queue': queue,
              },
              expiration: String(retryDelay),
            });
            
            this.channel.ack(msg); // Убираем из основной очереди
            this.logger.warn(`Message scheduled for retry ${retryCount + 1} in ${retryDelay}ms`);
          }
        }
      }
    });

    this.logger.log(`Subscribed to queue: ${queue}`);
  }

  /**
   * Вычисление задержки для retry (экспоненциальная).
   * @param retryCount - Номер попытки
   * @returns Задержка в миллисекундах
   */
  private getRetryDelay(retryCount: number): number {
    const delays = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 60s, 300s
    return delays[Math.min(retryCount - 1, delays.length - 1)];
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}