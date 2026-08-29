import { IsEmail, IsString, IsOptional, Length } from 'class-validator';

/**
 * DTO для входа в систему.
 * 
 * @example
 * ```typescript
 * const dto = new LoginDto();
 * dto.email = 'user@example.com';
 * dto.password = 'StrongP@ss123';
 * dto.twoFactorCode = '123456'; // опционально
 * ```
 */
export class LoginDto {
  /**
   * Email пользователя.
   */
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  /**
   * Пароль пользователя.
   */
  @IsString()
  password: string;

  /**
   * Код двухфакторной аутентификации (если включена).
   * Опционально.
   */
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: '2FA code must be 6 digits' })
  twoFactorCode?: string;
}
