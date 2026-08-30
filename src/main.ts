import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://gainday-app.vercel.app',
  ];

  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
  }
  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL.replace(/\/$/, ''));
  }

  app.enableCors({
    origin: Array.from(new Set(allowedOrigins)),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
