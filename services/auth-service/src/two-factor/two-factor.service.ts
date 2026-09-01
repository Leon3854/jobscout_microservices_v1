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
 * Поддерживает TOTP (Time-based One-Time Password).
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
   * Верифицировать TOTP код.
   *
   * @param userId - ID пользователя
   * @param token - TOTP код
   * @returns true если код валиден
   */
  async verify(userId: string, token: string): Promise<boolean> {
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

    if (isValid) {
      this.logger.log(`2FA verification successful for user ${userId}`);
    } else {
      this.logger.warn(`2FA verification failed for user ${userId}`);
    }

    return isValid;
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
}
