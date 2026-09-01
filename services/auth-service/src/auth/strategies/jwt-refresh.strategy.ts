import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      secretOrKey:
        process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me_456',
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    try {
      const user = await this.usersService.findById(payload.sub);

      if (!user.isActive) {
        throw new UnauthorizedException('User is not active');
      }

      return {
        id: user.id,
        email: user.email,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
