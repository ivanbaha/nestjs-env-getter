import {
  Module,
  DynamicModule,
  Global,
  Provider,
  InjectionToken,
  OptionalFactoryDependency,
  ModuleMetadata,
} from "@nestjs/common";
import { EnvGetterService } from "../env-getter/env-getter.service";
import { ClassConstructor } from "../shared/types/class-constructor.type";
import { type EnvGetterModuleOptions, ENV_GETTER_OPTIONS } from "../env-getter/types";

/**
 * Injection token used by `AppConfigModule.forRootAsync` with `useFactory`.
 * Use `@Inject(APP_CONFIG)` to inject the config created by the factory.
 */
export const APP_CONFIG = "APP_CONFIG";

export interface AppConfigModuleOptions {
  useClass?: ClassConstructor;
  useFactory?: (...args: unknown[]) => unknown;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  imports?: ModuleMetadata["imports"];
  providers?: Provider[];
  /** Pass-through to `EnvGetterModuleOptions` (envFilePath, configBaseDir). */
  envGetter?: EnvGetterModuleOptions;
}

@Global()
@Module({})
export class AppConfigModule {
  static forRoot(options: {
    useClass: ClassConstructor;
    imports?: ModuleMetadata["imports"];
    providers?: Provider[];
    envGetter?: EnvGetterModuleOptions;
  }): DynamicModule {
    const provider: Provider = { provide: options.useClass, useClass: options.useClass };
    const additionalProviders = options.providers || [];
    const envGetterProviders: Provider[] = options.envGetter
      ? [{ provide: ENV_GETTER_OPTIONS, useValue: options.envGetter }]
      : [];

    return {
      module: AppConfigModule,
      imports: options.imports || [],
      providers: [...envGetterProviders, EnvGetterService, provider, ...additionalProviders],
      exports: [EnvGetterService, provider, ...additionalProviders],
    };
  }

  static forRootAsync(options: AppConfigModuleOptions): DynamicModule {
    const additionalProviders = options.providers || [];
    const envGetterProviders: Provider[] = options.envGetter
      ? [{ provide: ENV_GETTER_OPTIONS, useValue: options.envGetter }]
      : [];

    if (options.useFactory) {
      const provider: Provider = {
        provide: APP_CONFIG,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };

      return {
        module: AppConfigModule,
        imports: options.imports || [],
        providers: [...envGetterProviders, EnvGetterService, provider, ...additionalProviders],
        exports: [EnvGetterService, provider, ...additionalProviders],
      };
    }

    // useClass path (register the class itself as token so consumer can inject by class)
    if (options.useClass) {
      const provider: Provider = { provide: options.useClass, useClass: options.useClass };

      return {
        module: AppConfigModule,
        imports: options.imports || [],
        providers: [...envGetterProviders, EnvGetterService, provider, ...additionalProviders],
        exports: [EnvGetterService, provider, ...additionalProviders],
      };
    }

    throw new Error("AppConfigModule.forRootAsync requires useClass or useFactory");
  }
}
