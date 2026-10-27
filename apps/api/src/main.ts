import './load-dotenv';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { APP_ENV, type AppEnv } from './config/env';

// Money leaves the API as decimal strings (see @jpt/shared DTO mappers); a raw
// bigint reaching JSON.stringify throws a TypeError, which the exception filter
// turns into a 500 — a bug we want to see, never a silently rounded number.

async function bootstrap() {
  // rawBody: webhook signatures are verified over the exact bytes received.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(), { bufferLogs: true, rawBody: true });
  const env = app.get<AppEnv>(APP_ENV);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-CSRF-Token', 'X-Request-Id'],
    maxAge: 600,
  });
  app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready'] });
  app.useBodyParser('json', { limit: '100kb' });
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Japan Property Token API')
      .setDescription(
        'Prototype API. All catalogue data is DEMO. Money is integer JPY encoded as strings; rates are basis points.',
      )
      .setVersion('0.1.0')
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
  }

  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
