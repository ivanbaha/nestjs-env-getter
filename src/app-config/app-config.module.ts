import {
  Module,
  DynamicModule,
  Global,
  Provider,
  Type,
  InjectionToken,
  OptionalFactoryDependency,
} from "@nestjs/common";
import { EnvGetterService } from "../env-getter/env-getter.service";

export interface AppConfigModuleOptions {
  useClass?: Type<unknown>;
  useFactory?: (...args: unknown[]) => unknown;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Global()
@Module({})
export class AppConfigModule {
  static forRoot(options: { useClass: Type<unknown> }): DynamicModule {
    const provider: Provider = { provide: options.useClass, useClass: options.useClass };

    return {
      module: AppConfigModule,
      providers: [EnvGetterService, provider],
      exports: [EnvGetterService, provider],
    };
  }

  static forRootAsync(options: AppConfigModuleOptions): DynamicModule {
    if (options.useFactory) {
      const provider: Provider = {
        provide: "APP_CONFIG",
        useFactory: options.useFactory,
        inject: options.inject || [],
      };

      return {
        module: AppConfigModule,
        providers: [EnvGetterService, provider],
        exports: [EnvGetterService, provider],
      };
    }

    // useClass path (register the class itself as token so consumer can inject by class)
    if (options.useClass) {
      const provider: Provider = { provide: options.useClass, useClass: options.useClass };

      return {
        module: AppConfigModule,
        providers: [EnvGetterService, provider],
        exports: [EnvGetterService, provider],
      };
    }

    throw new Error("AppConfigModule.forRootAsync requires useClass or useFactory");
  }
}
