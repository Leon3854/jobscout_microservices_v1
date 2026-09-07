// src/common/decorators/throttle-by.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const THROTTLE_BY_KEY = 'throttle_by';

/**
 * Декоратор для указания ключа throttling (например, email или IP).
 * @param key - Ключ для throttling
 */
export const ThrottleBy = (key: string) => SetMetadata(THROTTLE_BY_KEY, key);