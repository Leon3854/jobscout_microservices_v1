// src/common/interceptors/idempotency.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Интерцептор для обработки Idempotency Keys.
 * Защищает от повторных запросов с одинаковым ключом.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Перехватывает запрос и проверяет наличие Idempotency Key.
   * @param context - Контекст выполнения
   * @param next - Обработчик запроса
   * @returns Сохраненный ответ или результат выполнения
   */
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Применяем только к мутирующим методам
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['x-idempotency-key'];
    
    if (!idempotencyKey) {
      // Если ключа нет, пропускаем
      return next.handle();
    }

    const key = `idempotency:${idempotencyKey}`;
    
    // Проверяем, есть ли сохраненный ответ
    const cachedResponse = await this.redisService.get<any>(key);
    
    if (cachedResponse) {
      this.logger.log(`Returning cached response for key: ${idempotencyKey}`);
      return of(cachedResponse);
    }

    // Выполняем запрос и сохраняем ответ
    return next.handle().pipe(
      tap(async (response) => {
        await this.redisService.set(key, response, 86400); // 24 часа
        this.logger.log(`Cached response for key: ${idempotencyKey}`);
      }),
    );
  }
}