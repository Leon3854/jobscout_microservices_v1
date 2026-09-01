// src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';

// Мокаем bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

// Мокаем uuid
jest.mock('uuid', () => ({
  v4: jest.fn()
    .mockReturnValueOnce('access-jti')
    .mockReturnValueOnce('refresh-jti'),
}));

// Мокаем Prisma db
jest.mock('../prisma/db', () => ({
  db: {
    orm: {
      public: {
        User: {
          where: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          select: jest.fn(),
        },
      },
    },
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
            verifyAsync: jest.fn().mockResolvedValue({ 
              sub: 'user-id', 
              jti: 'jti-id',
              type: 'access',
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            exists: jest.fn().mockResolvedValue(false),
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            increment: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login user', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        isActive: true,
        twoFactorEnabled: false,
      };

      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });
  });
});