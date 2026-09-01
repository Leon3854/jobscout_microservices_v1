import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PRISMA_DB } from '../prisma/prisma.module';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RedisService } from '../redis/redis.service';
import { QueueService } from '../queue/queue.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(PRISMA_DB) private readonly db: any,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Создать нового пользователя с профилем.
   */
  async create(createUserDto: CreateUserDto) {
    const lockKey = `user:create:${createUserDto.email}`;
    const locked = await this.redisService.lock(lockKey, 10);

    if (!locked) {
      throw new ConflictException('Operation in progress, please try again');
    }

    try {
      // Проверяем существование пользователя
      const existingUser = await this.db.orm.public.User.where({
        email: createUserDto.email,
      }).first();

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Хешируем пароль
      const passwordHash = await bcrypt.hash(createUserDto.password, 12);

      // Создаём пользователя
      const user = await this.db.orm.public.User.create({
        email: createUserDto.email,
        passwordHash,
        fullName: createUserDto.fullName,
        isActive: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      });

      // Создаём профиль
      await this.db.orm.public.UserProfile.create({
        userId: user.id,
        bio: null,
        skills: [],
        experienceYears: 0,
      });

      // Отправляем событие
      try {
        await this.queueService.publish('user.created', {
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Failed to publish event: ${errorMessage}`);
      }

      this.logger.log(`User created: ${user.email}`);

      // Возвращаем без пароля
      const {
        passwordHash: _passwordHash,
        twoFactorSecret: _twoFactorSecret,
        twoFactorBackupCodes: _twoBackupCodes,
        ...safeUser
      } = user;
      return safeUser;
    } finally {
      await this.redisService.unlock(lockKey);
    }
  }

  /**
   * Найти пользователя по ID (без пароля).
   */
  async findById(id: string) {
    // Пробуем получить из кеша
    const cached = await this.redisService.get(`user:${id}`);
    if (cached) {
      return cached;
    }

    const user = await this.db.orm.public.User.where({ id }).first();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Убираем чувствительные данные
    const {
      passwordHash: _passwordHash,
      twoFactorSecret: _twoFactorSecret,
      twoFactorBackupCodes: _twoFactorBackupCodes,
      ...safeUser
    } = user;

    // Кешируем на 5 минут
    await this.redisService.set(`user:${id}`, safeUser, 300);

    return safeUser;
  }

  /**
   * Найти пользователя по email (включая пароль для аутентификации).
   */
  async findByEmail(email: string) {
    return this.db.orm.public.User.where({ email }).first();
  }

  /**
   * Обновить данные пользователя.
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findById(id);

    const updated = await this.db.orm.public.User.update(updateUserDto).where({
      id,
    });

    // Инвалидируем кеш
    await this.redisService.del(`user:${id}`);

    // Отправляем событие
    try {
      await this.queueService.publish('user.updated', {
        userId: id,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to publish event: ${errorMessage}`);
    }

    // Убираем чувствительные данные
    const { 
			passwordHash: _passwordHash,
			twoFactorSecret: _twoFactorSecret,
			twoFactorBackupCodes: _twoFactorBackupCodes,
			...safeUser 
		} = updated;
    return safeUser;
  }

  /**
   * Деактивировать пользователя.
   */
  async deactivate(id: string) {
    await this.findById(id);

    const deactivated = await this.db.orm.public.User.update({
      isActive: false,
    }).where({ id });

    await this.redisService.del(`user:${id}`);

    try {
      await this.queueService.publish('user.deactivated', {
        userId: id,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to publish event: ${errorMessage}`);
    }

    const { 
			passwordHash: _passwordHash,
			twoFactorSecret: _twoFactorSecret,
			twoFactorBackupCodes: _twoFactorBackupCodes, 
			...safeUser 
		} = deactivated;
    return safeUser;
  }
}
