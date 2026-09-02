// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Сервис аутентификации.
 * Обрабатывает логин, обновление токенов, выход из системы.
 * Управляет JWT токенами через HttpOnly cookies и jti для отслеживания сессий.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Аутентификация пользователя по email и паролю.
   * Создает сессию с jti в Redis для отслеживания.
   * @param loginDto - DTO с учетными данными пользователя
   * @param res - Express Response для установки cookies
   * @returns Информация о пользователе без токенов
   * @throws UnauthorizedException - при неверных учетных данных
   */
  async login(loginDto: LoginDto, res?: Response): Promise<any> {
    const { email, password, twoFactorCode } = loginDto;
    const lockKey = `login:${email}`;

    // Проверка блокировки аккаунта
    const isLocked = await this.redisService.exists(lockKey);
    if (isLocked) {
      const attempts = await this.redisService.get<number>(lockKey);
      throw new UnauthorizedException(
        `Too many login attempts. Try again in ${attempts} seconds`,
      );
    }

    try {
      // Поиск пользователя
      const user = await this.usersService.findByEmail(email);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Проверка пароля
      const isPasswordValid = await this.usersService.verifyPassword(user, password);
      if (!isPasswordValid) {
        await this.trackFailedAttempt(email);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Проверка 2FA
      if (user.twoFactorEnabled && !twoFactorCode) {
        throw new UnauthorizedException('2FA code required');
      }

      if (user.twoFactorEnabled && twoFactorCode) {
        const is2FAValid = await this.verifyTwoFactorCode(
          user.id,
          twoFactorCode,
        );
        if (!is2FAValid) {
          throw new UnauthorizedException('Invalid 2FA code');
        }
      }

      await this.resetFailedAttempts(email);

      // Генерация токенов с jti
      const tokens = await this.generateTokens(user);

      // Установка cookies если передан Response
      if (res) {
        this.setTokenCookies(res, tokens);
        return {
          message: 'Login successful',
          user: tokens.user,
        };
      }

      return tokens;
    } catch (error) {
      // Безопасное извлечение сообщения об ошибке
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Login failed for ${email}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Обновление токенов по refresh token.
   * Отзывает старую сессию и создает новую с новым jti.
   * @param refreshToken - Текущий refresh token
   * @param res - Express Response для установки новых cookies
   * @returns Новые токены или информация о пользователе
   * @throws UnauthorizedException - при невалидном refresh token
   */
  async refreshTokens(refreshToken: string, res?: Response): Promise<any> {
    try {
      // Верификация refresh token
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Проверка не отозван ли токен
      const isRevoked = await this.redisService.exists(
        `revoked:${refreshToken}`,
      );
      if (isRevoked) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Проверка существования сессии
      const sessionExists = await this.redisService.exists(
        `session:${payload.jti}`,
      );
      if (!sessionExists) {
        throw new UnauthorizedException('Session not found');
      }

      // Поиск пользователя
      const user = await this.usersService.findById(payload.sub);
      if (!user.isActive) {
        throw new UnauthorizedException('User is not active');
      }

      // Отзыв старого токена и сессии
      await this.revokeRefreshToken(refreshToken);
      await this.revokeSession(payload.jti);

      // Генерация новых токенов
      const tokens = await this.generateTokens(user);

      // Установка cookies если передан Response
      if (res) {
        this.setTokenCookies(res, tokens);
        return {
          message: 'Tokens refreshed',
          user: tokens.user,
        };
      }

      return tokens;
    } catch (error) {
      // Безопасное извлечение сообщения об ошибке
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Token refresh failed: ${errorMessage}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Выход из системы и отзыв всех токенов и сессий.
   * @param accessToken - Access token для извлечения jti
   * @param refreshToken - Refresh token для отзыва
   * @param res - Express Response для очистки cookies
   */
  async logout(
    accessToken?: string,
    refreshToken?: string,
    res?: Response,
  ): Promise<void> {
    // Отзыв refresh token
    if (refreshToken) {
      await this.revokeRefreshToken(refreshToken);
    }

    // Отзыв сессии по access token
    if (accessToken) {
      try {
        const payload = await this.jwtService.verifyAsync(accessToken, {
          secret: process.env.JWT_ACCESS_SECRET,
        });
        await this.revokeSession(payload.jti);
      } catch (error) {
        // Токен может быть уже истекшим
        // this.logger.debug('Access token already expired');
				if (error instanceof UnauthorizedException && error.message.includes('reuse')) {
					throw error;
				}
				this.logger.error('Token refresh failed');
				throw new UnauthorizedException('Invalid refresh token');
      }
    }

    // Очистка cookies
    if (res) {
      this.clearTokenCookies(res);
    }

    this.logger.log('User logged out');
  }

  /**
   * Выход со всех устройств пользователя.
   * Отзывает все активные сессии пользователя.
   * @param userId - ID пользователя
   */
  async logoutAll(userId: string): Promise<void> {
    // Получаем все сессии пользователя
    const sessions =
      (await this.redisService.get<any[]>(`user_sessions:${userId}`)) || [];

    // Отзываем каждую сессию
    for (const session of sessions) {
      await this.redisService.del(`session:${session.jti}`);
    }

    // Очищаем список сессий
    await this.redisService.del(`user_sessions:${userId}`);

    this.logger.log(`All sessions revoked for user ${userId}`);
  }

  /**
   * Генерация access и refresh токенов с jti.
   * Создает сессию в Redis для отслеживания.
   * @param user - Объект пользователя
   * @returns Сгенерированные токены
   * @private
   */
  private async generateTokens(user: any): Promise<TokenResponseDto> {
    try {
      // Генерация уникальных jti для токенов
      const accessJti = uuidv4();
      const refreshJti = uuidv4();

      this.logger.debug(`Generating tokens for user ${user.id}`);
      this.logger.debug(`Access JTI: ${accessJti}`);
      this.logger.debug(`Refresh JTI: ${refreshJti}`);

      const payload = {
        sub: user.id,
        email: user.email,
        fullName: user.fullName,
        jti: accessJti,
        type: 'access',
      };

      // Генерация access token
      const accessToken = await this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES as any) || '15m',
      });

      // Генерация refresh token
      const refreshToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          jti: refreshJti,
          type: 'refresh',
        },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: (process.env.JWT_REFRESH_EXPIRES as any) || '7d',
        },
      );

      // Сохранение сессии в Redis
      const sessionData = {
        userId: user.id,
        accessJti,
        refreshJti,
        createdAt: new Date().toISOString(),
      };

      this.logger.debug('Saving session to Redis...');

      // Сохраняем сессию с TTL = время жизни access token (15 минут)
      await this.redisService.set(
        `session:${accessJti}`,
        sessionData,
        900, // 15 минут
      );
      this.logger.debug(`Session saved: session:${accessJti}`);

      // Сохраняем refresh token в Redis (7 дней)
      await this.redisService.set(
        `refresh:${user.id}:${refreshToken}`,
        { valid: true, jti: refreshJti, accessJti },
        604800, // 7 дней
      );
      this.logger.debug(
        `Refresh token saved: refresh:${user.id}:${refreshToken}`,
      );

      // Добавляем сессию в список сессий пользователя
      const userSessions =
        (await this.redisService.get<any[]>(`user_sessions:${user.id}`)) || [];
      userSessions.push(sessionData);
      await this.redisService.set(
        `user_sessions:${user.id}`,
        userSessions,
        604800, // 7 дней
      );
      this.logger.debug(`User sessions updated: user_sessions:${user.id}`);

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate tokens: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Проверка валидности сессии по jti.
   * @param jti - Идентификатор сессии
   * @returns true если сессия активна
   */
  async isSessionValid(jti: string): Promise<boolean> {
    return this.redisService.exists(`session:${jti}`);
  }

  /**
   * Отзыв сессии по jti.
   * @param jti - Идентификатор сессии
   * @private
   */
  private async revokeSession(jti: string): Promise<void> {
    if (jti) {
      await this.redisService.del(`session:${jti}`);
      this.logger.debug(`Session revoked: ${jti}`);
    }
  }

  /**
   * Установка HttpOnly cookies с токенами.
   * @param res - Express Response объект
   * @param tokens - Токены для установки
   * @private
   */
  private setTokenCookies(res: Response, tokens: TokenResponseDto): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token cookie (15 минут)
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
      partitioned: true, // CHIPS support
    });

    // Refresh token cookie (7 дней, доступен только для refresh endpoint)
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
      partitioned: true,
    });
  }

  /**
   * Очистка cookies с токенами.
   * @param res - Express Response объект
   * @private
   */
  private clearTokenCookies(res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
  }

  /**
   * Отзыв refresh token (добавление в черный список).
   * @param refreshToken - Токен для отзыва
   * @private
   */
  private async revokeRefreshToken(refreshToken: string): Promise<void> {
    await this.redisService.set(
      `revoked:${refreshToken}`,
      { revoked: true },
      604800,
    );
  }

  /**
   * Отслеживание неудачных попыток входа.
   * @param email - Email пользователя
   * @private
   */
  private async trackFailedAttempt(email: string): Promise<void> {
    const key = `login:${email}`;
    const attempts = await this.redisService.increment(key, 900);

    if (attempts >= 5) {
      await this.redisService.set(key, 900, 900);
      this.logger.warn(`Account locked for ${email} due to too many attempts`);
    }
  }

  /**
   * Сброс счетчика неудачных попыток.
   * @param email - Email пользователя
   * @private
   */
  private async resetFailedAttempts(email: string): Promise<void> {
    await this.redisService.del(`login:${email}`);
  }

  /**
   * Верификация кода двухфакторной аутентификации.
   * @param userId - ID пользователя
   * @param code - Код 2FA для проверки
   * @returns true если код верный
   * @private
   */
  private async verifyTwoFactorCode(
    _userId: string,
    _code: string,
  ): Promise<boolean> {
    // TODO: Реализовать проверку 2FA кода
    return true;
  }
}
