import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

/**
 * DTO для создания нового пользователя.
 * Используется при регистрации.
 * 
 * @example
 * ```typescript
 * const dto = new CreateUserDto();
 * dto.email = 'user@example.com';
 * dto.password = 'StrongP@ss123';
 * dto.fullName = 'John Doe';
 * ```
 */
export class CreateUserDto {
  /**
   * Email пользователя.
   * Должен быть валидным email адресом.
   * Уникален в системе.
   */
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  /**
   * Пароль пользователя.
   * Требования: минимум 8 символов, заглавная и строчная буквы,
   * цифра и спецсимвол.
   */
  @IsString()
  @IsStrongPassword()
  password: string;

  /**
   * Полное имя пользователя.
   * Опционально, максимум 255 символов.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;
}
