import { randomUUID } from 'node:crypto';
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ChainModule } from './chain/chain.module';
import { AuthGuard, CsrfGuard } from './auth/guards';
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ConfigModule } from './config/config.module';
import { type AppEnv, loadEnv } from './config/env';
import { DevModule } from './dev/dev.module';
import { HealthController } from './health/health.controller';
import { KycModule } from './kyc/kyc.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { RegulatoryController } from './regulatory/regulatory.controller';
import { StatsModule } from './stats/stats.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({})
export class AppModule {
  static register(env: AppEnv = loadEnv()): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            genReqId: (req, res) => {
              const incoming = req.headers['x-request-id'];
              const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', 'req.headers["x-jpt-signature"]'],
            transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
          },
        }),
        ConfigModule.register(env),
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60_000, limit: env.RATE_LIMIT_PER_MINUTE }],
          // Integration tests exercise lockout logic, not the rate limiter.
          skipIf: () => env.NODE_ENV === 'test',
        }),
        PrismaModule,
        CommonModule,
        AuthModule,
        PropertiesModule,
        StatsModule,
        KycModule,
        SubscriptionsModule,
        AdminModule,
        ChainModule,
        ...(env.devEndpoints ? [DevModule] : []),
      ],
      controllers: [HealthController, RegulatoryController],
      providers: [
        // Order matters: rate limit → CSRF → authentication/authorisation.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    };
  }
}
