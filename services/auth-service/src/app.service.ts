import { Injectable } from '@nestjs/common';


/**
 * Базовый сервис приложения.
 *
 * @class AppService
 * @description
 * Предоставляет базовые методы для проверки работоспособности приложения.
 * Используется в основном для тестирования и health-проверок.
 *
 * @example
 * ```typescript
 * const service = new AppService();
 * const greeting = service.getHello(); // 'Hello World!'
 * ```
 */
@Injectable()
export class AppService {
	/**
   * Возвращает приветственное сообщение.
   *
   * @returns {string} Строка приветствия `'Hello World!'`
   *
   * @example
   * ```typescript
   * const message = appService.getHello();
   * console.log(message); // 'Hello World!'
   * ```
   */
  getHello(): string {
    return 'Hello World!';
  }
}
