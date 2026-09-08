// src/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { OutboxService } from '../queue/outbox.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

// Мокаем argon2
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$mock-hash'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 2,
}));

// Мокаем bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

// Мокаем Prisma db
jest.mock('../prisma/db', () => ({
  db: {
    orm: {
      public: {
        User: {
          where: jest.fn().mockReturnThis(),
          first: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      },
    },
  },
}));

describe('UsersService', () => {
  let service: UsersService;
  let outboxService: OutboxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: OutboxService,
          useValue: {
            addEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    outboxService = module.get<OutboxService>(OutboxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto = {
        email: 'test@test.com',
        password: 'SecurePass123!',
        fullName: 'Test User',
      };

      const mockUser = {
        id: 'user-id',
        email: 'test@test.com',
        fullName: 'Test User',
        passwordHash: '$argon2id$mock-hash',
        isActive: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      };

      const db = require('../prisma/db').db;
      db.orm.public.User.where.mockReturnThis();
      db.orm.public.User.first.mockResolvedValue(null);
      db.orm.public.User.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result).toBeDefined();
      expect(result.email).toBe('test@test.com');
      expect(result.passwordHash).toBeUndefined();
      expect(outboxService.addEvent).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({
          userId: 'user-id',
          email: 'test@test.com',
        }),
      );
    });

    it('should throw ConflictException if user exists', async () => {
      const createUserDto = {
        email: 'test@test.com',
        password: 'SecurePass123!',
        fullName: 'Test User',
      };

      const db = require('../prisma/db').db;
      db.orm.public.User.where.mockReturnThis();
      db.orm.public.User.first.mockResolvedValue({ id: 'existing-id' });

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@test.com',
        fullName: 'Test User',
      };

      const db = require('../prisma/db').db;
      db.orm.public.User.where.mockReturnThis();
      db.orm.public.User.first.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@test.com');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@test.com');
    });

    it('should return null if user not found', async () => {
      const db = require('../prisma/db').db;
      db.orm.public.User.where.mockReturnThis();
      db.orm.public.User.first.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@test.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user without sensitive data', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@test.com',
        fullName: 'Test User',
        passwordHash: 'hash',
        twoFactorSecret: 'secret',
        twoFactorBackupCodes: ['code1'],
      };

      const db = require('../prisma/db').db;
      db.orm.public.User.where.mockReturnThis();
      db.orm.public.User.first.mockResolvedValue(mockUser);

      const result = await service.findById('user-id');

      expect(result).toBeDefined();
      expect(result.passwordHash).toBeUndefined();
      expect(result.twoFactorSecret).toBeUndefined();
      expect(result.twoFactorBackupCodes).toBeUndefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      const db = require('../prisma/db').db;
      db.orm.public.User.where.mockReturnThis();
      db.orm.public.User.first.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});