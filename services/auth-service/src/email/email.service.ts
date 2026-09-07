import { BadRequestException, Injectable, Logger} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { RedisService } from '../redis/redis.service';

/**
 * Интерфейс для отправки email.
 */
export interface EmailOptions {
  
  to: string; // Email получателя.
  subject: string; // Тема письма.
  text?: string; // Текст письма (plain text).
  html?: string; // HTML содержимое письма.
}

/**
* Сервис для отправки email с защитой от спама.
* Использует nodemailer с SMTP и Redis для rate limiting.
*/
@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly redisService: RedisService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

	/**
   * Проверка rate limit для email.
   * Не более 1 письма в 60 секунд на адрес.
   * @param email - Email получателя
   * @throws TooManyRequestsException - при превышении лимита
   * @private
   */
	private async checkRateLimit(email: string): Promise<void> {
    const key = `email:rate:${email}`;
    const exists = await this.redisService.exists(key);

    if (exists) {
      this.logger.warn(`Rate limit exceeded for email: ${email}`);
      throw new BadRequestException(
        'Too many emails sent to this address. Please try again in 60 seconds.',
      );
    }

    // Устанавливаем ключ с TTL 60 секунд
    await this.redisService.set(key, { sentAt: new Date().toISOString() }, 60);
  }


  /**
   * Отправить email.
   *
   * @returns Информация об отправке
   * Отправить email с проверкой rate limit.
   * @param options - Параметры письма
   * @example
   * ```typescript
   * await emailService.send({
   *   to: 'user@example.com',
   *   subject: 'Welcome',
   *   text: 'Welcome to JobScout!',
   *   html: '<h1>Welcome to JobScout!</h1>'
   * });
   * ```
   */
  async send(options: EmailOptions): Promise<void> {
		// Проверяем rate limit
    await this.checkRateLimit(options.to);

    // Отправляем email
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email sent to ${options.to}`);
    } catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email to ${options.to}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Отправить email с кодом подтверждения.
   *
   * @param to - Email получателя
   * @param code - Код подтверждения
   */
  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your verification code - JobScout',
      text: `Your verification code is: ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">JobScout Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #007bff; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
            ${code}
          </div>
          <p style="color: #666; margin-top: 20px;">This code will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });
  }

  /**
   * Отправить email для сброса пароля.
   *
   * @param to - Email получателя
   * @param resetLink - Ссылка для сброса пароля
   */
  async sendPasswordReset(to: string, resetLink: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your password - JobScout',
      text: `Click here to reset your password: ${resetLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>Click the button below to reset your password:</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #666;">This link will expire in 30 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
  }
}
