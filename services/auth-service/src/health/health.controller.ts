import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RedisService } from '../redis/redis.service';
import { QueueService } from '../queue/queue.service';
import { PRISMA_DB } from '../prisma/prisma.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(PRISMA_DB) private readonly db: any,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check service health' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check() {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      components: {
        database: { status: 'ok' },
        redis: { status: 'ok' },
        rabbitmq: { status: 'ok' },
      },
    };

    // Проверяем базу данных через Prisma 8
    try {
      const result = await this.db.orm.public.User
        .select(['id'])
        .limit(1)
        .first();
      
      health.components.database = { status: 'ok', message: 'Database responding' };
    } catch (error: any) {
      health.components.database = { status: 'error', message: error.message };
      health.status = 'error';
    }

    // Проверяем Redis
    try {
      const redisPing = await this.redisService.ping();
      if (!redisPing) {
        health.components.redis = { status: 'error', message: 'Redis not responding' };
        health.status = 'error';
      }
    } catch (error: any) {
      health.components.redis = { status: 'error', message: error.message };
      health.status = 'error';
    }

    // Проверяем RabbitMQ
    try {
      const rabbitOk = await this.queueService.healthCheck();
      if (!rabbitOk) {
        health.components.rabbitmq = { 
          status: 'warning', 
          message: 'RabbitMQ not connected (lazy connection)' 
        };
      }
    } catch (error: any) {
      health.components.rabbitmq = { status: 'error', message: error.message };
      health.status = 'error';
    }

    return health;
  }
}
