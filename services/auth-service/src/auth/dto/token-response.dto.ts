/**
 * DTO ответа с токенами.
 */
export class TokenResponseDto {
  /**
   * Access token (JWT).
   * Короткоживущий (15 минут).
   */
  accessToken: string;

  /**
   * Refresh token.
   * Долгоживущий (7 дней).
   */
  refreshToken: string;

  /**
   * Тип токена.
   */
  tokenType: string = 'Bearer';

  /**
   * Время жизни access token в секундах.
   */
  expiresIn: number;

  /**
   * Информация о пользователе.
   */
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
}
