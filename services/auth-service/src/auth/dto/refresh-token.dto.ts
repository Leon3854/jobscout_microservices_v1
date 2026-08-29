import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO для обновления токенов.
 * 
 * @example
 * ```typescript
 * const dto = new RefreshTokenDto();
 * dto.refreshToken = 'eyJhbGciOiJIUzI1NiIs...';
 * ```
 */
export class RefreshTokenDto {
  /**
   * Refresh token для получения новой пары токенов.
   */
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
