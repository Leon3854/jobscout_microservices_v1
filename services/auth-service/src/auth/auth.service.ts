import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    const { email, password, twoFactorCode } = loginDto;
    const lockKey = `login:${email}`;

    const isLocked = await this.redisService.exists(lockKey);
    if (isLocked) {
      const attempts = await this.redisService.get<number>(lockKey);
      throw new UnauthorizedException(
        `Too many login attempts. Try again in ${attempts} seconds`,
      );
    }

    try {
      const user = await this.usersService.findByEmail(email);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        await this.trackFailedAttempt(email);
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.twoFactorEnabled && !twoFactorCode) {
        throw new UnauthorizedException('2FA code required');
      }

      if (user.twoFactorEnabled && twoFactorCode) {
        const is2FAValid = await this.verifyTwoFactorCode(user.id, twoFactorCode);
        if (!is2FAValid) {
          throw new UnauthorizedException('Invalid 2FA code');
        }
      }

      await this.resetFailedAttempts(email);

      return this.generateTokens(user);
    } catch (error) {
      this.logger.warn(`Login failed for ${email}: ${error.message}`);
      throw error;
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokenResponseDto> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const isRevoked = await this.redisService.exists(`revoked:${refreshToken}`);
      if (isRevoked) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user.isActive) {
        throw new UnauthorizedException('User is not active');
      }

      await this.revokeRefreshToken(refreshToken);

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    await this.revokeRefreshToken(refreshToken);
    this.logger.log('User logged out');
  }

  private async generateTokens(user: any): Promise<TokenResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_EXPIRES as any) || '15m',
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES as any) || '7d',
      },
    );

    await this.redisService.set(
      `refresh:${user.id}:${refreshToken}`,
      { valid: true },
      604800,
    );

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
  }

  private async revokeRefreshToken(refreshToken: string): Promise<void> {
    await this.redisService.set(
      `revoked:${refreshToken}`,
      { revoked: true },
      604800,
    );
  }

  private async trackFailedAttempt(email: string): Promise<void> {
    const key = `login:${email}`;
    const attempts = await this.redisService.increment(key, 900);
    
    if (attempts >= 5) {
      await this.redisService.set(key, 900, 900);
      this.logger.warn(`Account locked for ${email} due to too many attempts`);
    }
  }

  private async resetFailedAttempts(email: string): Promise<void> {
    await this.redisService.del(`login:${email}`);
  }

  private async verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
    return true;
  }
}
