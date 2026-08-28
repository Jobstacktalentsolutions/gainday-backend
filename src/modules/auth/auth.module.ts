import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  JwtModule,
  JwtModuleAsyncOptions,
  JwtModuleOptions,
} from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';

const jwtModuleOptions: JwtModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService): JwtModuleOptions => {
    const expiresIn =
      configService.get<string | number>('jwt.expiresIn') || '7d';
    return {
      secret: configService.get<string>('jwt.secret'),
      signOptions: { expiresIn: expiresIn },
    } as JwtModuleOptions;
  },
};

@Module({
  imports: [
    forwardRef(() => UsersModule),
    NotificationsModule,
    PassportModule,
    JwtModule.registerAsync(jwtModuleOptions),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    RolesGuard,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [
    AuthService,
    RolesGuard,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    PassportModule,
  ],
})
export class AuthModule {}
