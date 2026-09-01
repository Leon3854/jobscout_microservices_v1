// src/auth/strategies/jwt.strategy.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { RedisService } from '../../redis/redis.service';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string | null;
  jti?: string;
  type?: string;
  iat?: number;
  exp?: number;
}

/**
 * Стратегия JWT аутентификации.
 * Поддерживает токены из Authorization header и HttpOnly cookies.
 * Проверяет jti в Redis для валидации сессии.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Проверка cookie в первую очередь
        (request: Request) => {
          return request?.cookies?.access_token || null;
        },
        // Затем Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey:
        process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me_123',
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  /**
   * Валидация JWT payload и проверка сессии в Redis.
   * @param req - Express Request объект
   * @param payload - Данные из JWT токена
   * @returns Информация о пользователе
   * @throws UnauthorizedException - при невалидном токене или сессии
   */
  async validate(req: Request, payload: JwtPayload) {
    try {
      this.logger.debug(`Validating JWT for user ${payload.sub}`);
      this.logger.debug(`JTI: ${payload.jti}`);
      this.logger.debug(`Type: ${payload.type}`);

      // Проверка jti в Redis
      if (payload.jti) {
        const sessionExists = await this.redisService.exists(
          `session:${payload.jti}`,
        );
        this.logger.debug(`Session exists: ${sessionExists}`);
        if (!sessionExists) {
          throw new UnauthorizedException('Session has been revoked');
        }
      }

      // Проверка типа токена
      if (payload.type && payload.type !== 'access') {
        this.logger.warn(`Invalid token type: ${payload.type}`);

        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.usersService.findById(payload.sub);

      if (!user.isActive) {
        throw new UnauthorizedException('User is not active');
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        jti: payload.jti,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`JWT validation failed: ${errorMessage}`);
      throw new UnauthorizedException(`Invalid token: ${errorMessage}`);
    }
  }
}
