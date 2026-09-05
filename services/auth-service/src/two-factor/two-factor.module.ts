import { Module } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { UsersModule } from '../users/users.module';
import { TwoFactorController } from './two-factor.controller';

@Module({
  imports: [UsersModule],
  controllers: [TwoFactorController],
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
