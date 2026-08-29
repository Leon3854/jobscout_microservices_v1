import { IsString, Length } from 'class-validator';

/**
 * DTO для верификации 2FA кода.
 */
export class TwoFactorVerifyDto {
  /**
   * Код двухфакторной аутентификации.
   * 6 цифр.
   */
  @IsString()
  @Length(6, 6, { message: '2FA code must be 6 digits' })
  code: string;
}
