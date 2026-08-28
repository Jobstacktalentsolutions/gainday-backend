import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { DbModule } from './db/db.module';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { SimulationsModule } from './modules/simulations/simulations.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailModule } from './modules/email/email.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Database connection using Drizzle ORM
    DbModule,

    // Queue connection using BullMQ & Redis
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          username: config.get<string>('redis.username'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),

    // Core Business Logic Modules
    AuthModule,
    UsersModule,
    JobsModule,
    SimulationsModule,
    SubmissionsModule,
    ScoringModule,
    PaymentsModule,
    AdminModule,
    NotificationsModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
