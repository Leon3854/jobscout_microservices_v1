import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Декоратор для проверки надёжности пароля.
 * Требования:
 * - Минимум 8 символов
 * - Минимум 1 заглавная буква
 * - Минимум 1 строчная буква
 * - Минимум 1 цифра
 * - Минимум 1 спецсимвол
 *
 * @param validationOptions - Опции валидации class-validator
 * @returns PropertyDecorator
 *
 * @example
 * ```typescript
 * class CreateUserDto {
 *   @IsStrongPassword()
 *   password: string;
 * }
 * ```
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;

          const hasUpperCase = /[A-Z]/.test(value);
          const hasLowerCase = /[a-z]/.test(value);
          const hasNumber = /\d/.test(value);
          const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
          const hasMinLength = value.length >= 8;

          return (
            hasUpperCase &&
            hasLowerCase &&
            hasNumber &&
            hasSpecialChar &&
            hasMinLength
          );
        },
        defaultMessage(_args: ValidationArguments) {
          return 'Password must contain at least 8 characters, including uppercase, lowercase, number and special character';
        },
      },
    });
  };
}
