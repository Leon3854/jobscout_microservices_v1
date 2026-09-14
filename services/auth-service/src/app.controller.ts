import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Базовый контроллер приложения.
 *
 * @class AppController
 * @description
 * Обрабатывает корневой эндпоинт (`/`).
 * Используется для базовой проверки работоспособности приложения.
 *
 * ⚠️ **Важно:** В production этот контроллер обычно удаляют или заменяют
 * на health-check через `HealthController` (у нас уже есть `/api/v1/health`).
 *
 * @example
 * ```typescript
 * // GET /api/v1/
 * // Response: "Hello World!"
 * ```
 */
@Controller()
export class AppController {
	/**
   * Создаёт экземпляр AppController.
   *
   * @param {AppService} appService - Сервис приложения (внедряется через DI)
   */
  constructor(private readonly appService: AppService) {}

	/**
   * Обрабатывает GET-запрос на корневой эндпоинт.
   *
   * @returns {string} Приветственное сообщение `'Hello World!'`
   *
   * @example
   * ```bash
   * curl http://localhost:3001/api/v1/
   * # Hello World!
   * ```
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
