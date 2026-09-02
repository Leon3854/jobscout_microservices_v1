// src/users/users.service.ts
import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { db } from '../prisma/db';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * Сервис пользователей.
 * Обрабатывает CRUD операции с пользователями.
 * Использует Argon2id для хеширования паролей.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  /**
   * Конфигурация Argon2id.
   * Параметры оптимизированы для безопасности.
   */
  private readonly argon2Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 итерации
    parallelism: 1,    // 1 поток
  } as const;

  /**
   * Создание нового пользователя.
   * @param createUserDto - DTO с данными пользователя
   * @returns Созданный пользователь без чувствительных данных
   * @throws ConflictException - если email уже существует
   */
  async create(createUserDto: CreateUserDto) {
    const existingUser = await db.orm.public.User.where({
      email: createUserDto.email,
    }).first();

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Хешируем пароль с Argon2id
    const passwordHash = await argon2.hash(createUserDto.password, this.argon2Options);

    const user = await db.orm.public.User.create({
      email: createUserDto.email,
      passwordHash,
      fullName: createUserDto.fullName,
      isActive: true,
			twoFactorBackupCodes: [],
			twoFactorSecret: null,
    });

    this.logger.log(`User created: ${user.id}`);

    // Возвращаем пользователя без чувствительных данных
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.twoFactorSecret;
    delete safeUser.twoFactorBackupCodes;

    return safeUser;
  }

  /**
   * Поиск пользователя по email.
   * @param email - Email пользователя
   * @returns Пользователь или null
   */
  async findByEmail(email: string) {
    const user = await db.orm.public.User.where({ email }).first();
    return user || null;
  }

  /**
   * Поиск пользователя по ID.
   * @param id - ID пользователя
   * @returns Пользователь без чувствительных данных
   * @throws NotFoundException - если пользователь не найден
   */
  async findById(id: string) {
    const user = await db.orm.public.User.where({ id }).first();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Возвращаем пользователя без чувствительных данных
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.twoFactorSecret;
    delete safeUser.twoFactorBackupCodes;

    return safeUser;
  }

  /**
   * Обновление пользователя.
   * @param id - ID пользователя
   * @param updateUserDto - DTO с обновляемыми данными
   * @returns Обновленный пользователь без чувствительных данных
   * @throws NotFoundException - если пользователь не найден
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    const existingUser = await db.orm.public.User.where({ id }).first();

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = { ...updateUserDto };

    // Если обновляется пароль, хешируем его с Argon2id
    if (updateUserDto.password) {
      updateData.passwordHash = await argon2.hash(updateUserDto.password, this.argon2Options);
      delete updateData.password;
    }

    const updatedUser = await db.orm.public.User.update(updateData).where({ id });

    // Возвращаем пользователя без чувствительных данных
    const safeUser = { ...updatedUser };
    delete safeUser.passwordHash;
    delete safeUser.twoFactorSecret;
    delete safeUser.twoFactorBackupCodes;

    return safeUser;
  }

  /**
   * Верификация пароля пользователя.
   * @param user - Объект пользователя с passwordHash
   * @param password - Пароль для проверки
   * @returns true если пароль верный
   */
  async verifyPassword(user: any, password: string): Promise<boolean> {
    try {
      // Проверяем, является ли хеш Argon2id
      if (user.passwordHash.startsWith('$argon2id$') || user.passwordHash.startsWith('$argon2')) {
        return await argon2.verify(user.passwordHash, password);
      }
      
      // Обратная совместимость с bcrypt (для старых пользователей)
      if (user.passwordHash.startsWith('$2b$') || user.passwordHash.startsWith('$2a$')) {
        const bcrypt = require('bcrypt');
        const isValid = await bcrypt.compare(password, user.passwordHash);
        
        // Если пароль верный, обновляем хеш на Argon2id
        if (isValid) {
          const newHash = await argon2.hash(password, this.argon2Options);
          await db.orm.public.User.update({
            passwordHash: newHash,
          }).where({ id: user.id });
          this.logger.log(`Password hash upgraded to Argon2id for user ${user.id}`);
        }
        
        return isValid;
      }
      
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Password verification failed: ${errorMessage}`);
      return false;
    }
  }
}