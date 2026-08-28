import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createDb, createDbPool } from './client';
import { DRIZZLE } from './db.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pool = createDbPool(configService.get<string>('database.url'));
        return createDb(pool);
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}
