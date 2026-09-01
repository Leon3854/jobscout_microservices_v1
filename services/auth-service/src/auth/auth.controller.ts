// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

/**
 * Контроллер аутентификации.
 * Обрабатывает HTTP запросы связанные с аутентификацией.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Вход пользователя в систему.
   * Устанавливает HttpOnly cookies с токенами.
   * @param loginDto - Данные для входа
   * @param res - Express Response для установки cookies
   * @returns Информация о пользователе
   */
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(loginDto, res);
  }

  /**
   * Обновление токенов по refresh token из cookie или body.
   * @param refreshTokenDto - DTO с refresh token (опционально)
   * @param req - Express Request для чтения cookies
   * @param res - Express Response для установки новых cookies
   * @returns Новые токены или информация о пользователе
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Приоритет cookie над body
    const refreshToken =
      req.cookies?.refresh_token || refreshTokenDto.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    return this.authService.refreshTokens(refreshToken, res);
  }

  /**
   * Выход из системы и отзыв refresh token.
   * @param refreshTokenDto - DTO с refresh token (опционально)
   * @param req - Express Request для чтения cookies
   * @param res - Express Response для очистки cookies
   * @returns Сообщение об успешном выходе
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = req.cookies?.access_token;
    const refreshToken =
      req.cookies?.refresh_token || refreshTokenDto.refreshToken;

    await this.authService.logout(accessToken, refreshToken, res);
    return { message: 'Logout successful' };
  }

  /**
   * Выход со всех устройств пользователя.
   * @param req - Express Request с данными пользователя
   * @returns Сообщение об успешном выходе со всех устройств
   */
  @Post('logout-all')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({
    status: 200,
    description: 'Logout from all devices successful',
  })
  async logoutAll(@Req() req: any) {
    await this.authService.logoutAll(req.user.id);
    return { message: 'Logout from all devices successful' };
  }

  /**
   * Верификация access token.
   * @param req - Express Request с данными пользователя
   * @returns Информация о валидности токена
   */
  @Post('verify')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Verify access token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async verify(@Req() req: any) {
    return {
      valid: true,
      user: req.user,
    };
  }
}
