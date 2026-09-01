import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private connection!: amqp.ChannelModel;
  private channel!: amqp.Channel;
  private connected = false;
  private readonly logger = new Logger(QueueService.name);

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      this.connected = true;
      this.logger.log('RabbitMQ connected successfully');
    } catch (error: any) {
      this.logger.error(`RabbitMQ connection failed: ${error.message}`);
      this.connected = false;
      throw error;
    }
  }

  async publish(
    queue: string,
    message: any,
    options?: amqp.Options.Publish,
  ): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    await this.channel.assertQueue(queue, { durable: true });
    const buffer = Buffer.from(JSON.stringify(message));

    this.channel.sendToQueue(queue, buffer, {
      persistent: true,
      ...options,
    });

    this.logger.debug(`Message published to ${queue}`);
  }

  async subscribe(
    queue: string,
    handler: (message: any) => Promise<void>,
  ): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    await this.channel.assertQueue(queue, { durable: true });

    this.channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          this.channel.ack(msg);
        } catch (error: any) {
          this.logger.error(
            `Error processing message from ${queue}: ${error.message}`,
          );
          this.channel.nack(msg, false, true);
        }
      }
    });

    this.logger.log(`Subscribed to queue: ${queue}`);
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
