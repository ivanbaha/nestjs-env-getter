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
  imports?: any[];
  providers?: Provider[];
}

@Global()
@Module({})
export class AppConfigModule {
  static forRoot(options: { useClass: Type<unknown>; imports?: any[]; providers?: Provider[] }): DynamicModule {
    const provider: Provider = { provide: options.useClass, useClass: options.useClass };
    const additionalProviders = options.providers || [];

    return {
      module: AppConfigModule,
      imports: options.imports || [],
      providers: [EnvGetterService, provider, ...additionalProviders],
      exports: [EnvGetterService, provider, ...additionalProviders],
    };
  }

  static forRootAsync(options: AppConfigModuleOptions): DynamicModule {
    const additionalProviders = options.providers || [];

    if (options.useFactory) {
      const provider: Provider = {
        provide: "APP_CONFIG",
        useFactory: options.useFactory,
        inject: options.inject || [],
      };

      return {
        module: AppConfigModule,
        imports: options.imports || [],
        providers: [EnvGetterService, provider, ...additionalProviders],
        exports: [EnvGetterService, provider, ...additionalProviders],
      };
    }

    // useClass path (register the class itself as token so consumer can inject by class)
    if (options.useClass) {
      const provider: Provider = { provide: options.useClass, useClass: options.useClass };

      return {
        module: AppConfigModule,
        imports: options.imports || [],
        providers: [EnvGetterService, provider, ...additionalProviders],
        exports: [EnvGetterService, provider, ...additionalProviders],
      };
    }

    throw new Error("AppConfigModule.forRootAsync requires useClass or useFactory");
  }
}
