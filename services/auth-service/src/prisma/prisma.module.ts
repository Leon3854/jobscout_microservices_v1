import { Module, Global } from '@nestjs/common';
import { db } from './db';

export const PRISMA_DB = 'PRISMA_DB';

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_DB,
      useValue: db,
    },
  ],
  exports: [PRISMA_DB],
})
export class PrismaModule {}
