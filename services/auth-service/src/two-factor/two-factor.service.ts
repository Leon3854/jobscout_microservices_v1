// src/two-factor/two-factor.service.ts
import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PRISMA_DB } from '../prisma/prisma.module';
import { RedisService } from '../redis/redis.service';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Сервис двухфакторной аутентификации.
 * Поддерживает TOTP (Time-based One-Time Password) с защитой от брутфорса.
 *
 * @class TwoFactorService
 */
@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @Inject(PRISMA_DB) private readonly db: any,
    private readonly redisService: RedisService,
  ) {
    // Настраиваем TOTP
    authenticator.options = {
      window: 1, // Допускаем 1 шаг в каждую сторону
      step: 30, // 30 секунд на код
    };
  }

  /**
   * Сгенерировать секрет для 2FA.
   *
   * @param userId - ID пользователя
   * @returns Секрет и URI для QR кода
   */
  async generateSecret(userId: string) {
    const secret = authenticator.generateSecret();
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const otpauthUrl = authenticator.keyuri(
      user.email,
      process.env.TOTP_ISSUER || 'JobScout',
      secret,
    );

    // Сохраняем секрет во временном хранилище (5 минут)
    await this.redisService.set(`2fa:setup:${userId}`, { secret }, 300);

    return {
      secret,
      otpauthUrl,
    };
  }

  /**
   * Верифицировать и активировать 2FA.
   *
   * @param userId - ID пользователя
   * @param token - TOTP код для верификации
   * @returns true если 2FA активирована
   */
  async enable(userId: string, token: string): Promise<boolean> {
    const setupData = await this.redisService.get<{ secret: string }>(
      `2fa:setup:${userId}`,
    );

    if (!setupData) {
      throw new UnauthorizedException('2FA setup expired, please try again');
    }

    const isValid = authenticator.verify({
      token,
      secret: setupData.secret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Сохраняем секрет в базе
    await this.db.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: setupData.secret,
        twoFactorEnabled: true,
      },
    });

    // Удаляем временный секрет
    await this.redisService.del(`2fa:setup:${userId}`);

    this.logger.log(`2FA enabled for user ${userId}`);
    return true;
  }

  /**
   * Верифицировать TOTP код с защитой от брутфорса.
   * Максимум 3 попытки, после чего блокировка на 15 минут.
   *
   * @param userId - ID пользователя
   * @param token - TOTP код
   * @returns true если код валиден
   * @throws UnauthorizedException - при неверном коде или блокировке
   */
  async verify(userId: string, token: string): Promise<boolean> {
    // 🔒 Проверка блокировки
    const lockKey = `2fa_lock:${userId}`;
    const isLocked = await this.redisService.exists(lockKey);
    
    if (isLocked) {
      const lockData = await this.redisService.get<any>(lockKey);
      const remainingTime = lockData?.remainingTime || 900;
      this.logger.warn(`2FA verification blocked for user ${userId}`);
      throw new UnauthorizedException(
        `Too many 2FA attempts. Try again in ${Math.ceil(remainingTime / 60)} minutes`,
      );
    }

    // 🔒 Получаем счетчик попыток
    const attemptsKey = `2fa_attempts:${userId}`;
    const attemptsData = await this.redisService.get<any>(attemptsKey) || { count: 0 };
    
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });

    if (!user?.twoFactorSecret) {
      throw new UnauthorizedException('2FA is not enabled');
    }

    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      attemptsData.count += 1;
      
      // 🔒 Если превышено 3 попытки
      if (attemptsData.count >= 3) {
        // Удаляем счетчик
        await this.redisService.del(attemptsKey);
        
        // Устанавливаем блокировку на 15 минут
        await this.redisService.set(lockKey, {
          lockedAt: new Date().toISOString(),
          remainingTime: 900, // 15 минут в секундах
        }, 900);
        
        this.logger.error(`2FA blocked for user ${userId} due to 3 failed attempts`);
        throw new UnauthorizedException('Too many 2FA attempts. Blocked for 15 minutes');
      }
      
      // Обновляем счетчик попыток (TTL 5 минут)
      await this.redisService.set(attemptsKey, attemptsData, 300);
      
      const remainingAttempts = 3 - attemptsData.count;
      this.logger.warn(`2FA verification failed for user ${userId}. ${remainingAttempts} attempts remaining`);
      throw new UnauthorizedException(`Invalid 2FA code. ${remainingAttempts} attempts remaining`);
    }

    // ✅ Код верный - сбрасываем счетчик
    await this.redisService.del(attemptsKey);
    await this.redisService.del(lockKey);
    
    this.logger.log(`2FA verification successful for user ${userId}`);
    return true;
  }

  /**
   * Отключить 2FA.
   *
   * @param userId - ID пользователя
   */
  async disable(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
      },
    });

    // Очищаем блокировки и попытки
    await this.redisService.del(`2fa_lock:${userId}`);
    await this.redisService.del(`2fa_attempts:${userId}`);

    this.logger.log(`2FA disabled for user ${userId}`);
  }

  /**
   * Сгенерировать резервные коды.
   *
   * @param userId - ID пользователя
   * @returns Массив резервных кодов
   */
  async generateBackupCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: 10 }, () => {
      return crypto.randomBytes(4).toString('hex').toUpperCase();
    });

    // Хешируем и сохраняем в базе
    const hashedCodes = await Promise.all(
      codes.map((code) => bcrypt.hash(code, 10)),
    );

    await this.db.user.update({
      where: { id: userId },
      data: {
        twoFactorBackupCodes: hashedCodes,
      },
    });

    return codes;
  }

  /**
   * Сбросить блокировку 2FA (для администратора).
   *
   * @param userId - ID пользователя
   */
  async resetLock(userId: string): Promise<void> {
    await this.redisService.del(`2fa_lock:${userId}`);
    await this.redisService.del(`2fa_attempts:${userId}`);
    this.logger.log(`2FA lock reset for user ${userId}`);
  }
}