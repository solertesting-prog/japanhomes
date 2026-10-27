import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_ENV, type AppEnv } from './env';

/** Makes the validated environment injectable everywhere as APP_ENV. */
@Global()
@Module({})
export class ConfigModule {
  static register(env: AppEnv): DynamicModule {
    return { module: ConfigModule, providers: [{ provide: APP_ENV, useValue: env }], exports: [APP_ENV] };
  }
}
