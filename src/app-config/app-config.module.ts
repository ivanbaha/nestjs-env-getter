import {
  Module,
  DynamicModule,
  Provider,
  InjectionToken,
  OptionalFactoryDependency,
  ModuleMetadata,
  Scope,
} from "@nestjs/common";
import {
  PARAMTYPES_METADATA,
  SELF_DECLARED_DEPS_METADATA,
  OPTIONAL_DEPS_METADATA,
  PROPERTY_DEPS_METADATA,
  SCOPE_OPTIONS_METADATA,
} from "@nestjs/common/constants";
import { EnvGetterService } from "../env-getter/env-getter.service";
import { EnvGetterModule } from "../env-getter/env-getter.module";
import { ClassConstructor } from "../shared/types/class-constructor.type";
import { type EnvGetterModuleOptions } from "../env-getter/types";
import { loadEnvFromOptions } from "../env-getter/load-env-from-options";

/**
 * Injection token used by `AppConfigModule` to expose the root configuration instance.
 * Can be injected via `@Inject(APP_CONFIG)` for both `useClass` and `useFactory` configurations.
 */
export const APP_CONFIG = "APP_CONFIG";

export interface AppConfigModuleRootOptions {
  useClass: ClassConstructor;
  imports?: ModuleMetadata["imports"];
  providers?: Provider[];
  /** Pass-through to `EnvGetterModuleOptions` (envFilePath, configBaseDir, env). */
  envGetter?: EnvGetterModuleOptions;
  /** @default true */
  aggregateErrors?: boolean;
}

export interface AppConfigModuleOptions {
  useClass?: ClassConstructor;
  useFactory?: (...args: any[]) => unknown;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  /** Token for the factory result (`useFactory` only); `APP_CONFIG` is aliased to it. @default APP_CONFIG */
  provide?: InjectionToken;
  imports?: ModuleMetadata["imports"];
  providers?: Provider[];
  /** Pass-through to `EnvGetterModuleOptions` (envFilePath, configBaseDir, env). */
  envGetter?: EnvGetterModuleOptions;
  /** Aggregate all validation errors thrown during `useClass` construction (`useClass` only). @default true */
  aggregateErrors?: boolean;
}

function isForwardRef(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "forwardRef" in (value as Record<string, unknown>) &&
    typeof (value as { forwardRef?: unknown }).forwardRef === "function"
  );
}

function createConfigClassProvider(cls: ClassConstructor, aggregateErrors?: boolean): Provider {
  const fallback: Provider = { provide: cls, useClass: cls };

  if (aggregateErrors === false) {
    return fallback;
  }

  const propertyDeps = Reflect.getMetadata(PROPERTY_DEPS_METADATA, cls) as unknown[] | undefined;
  if (Array.isArray(propertyDeps) && propertyDeps.length > 0) {
    return fallback;
  }

  const scopeOptions = Reflect.getMetadata(SCOPE_OPTIONS_METADATA, cls) as
    { scope?: Scope; durable?: boolean } | undefined;
  if ((scopeOptions?.scope !== undefined && scopeOptions.scope !== Scope.DEFAULT) || Boolean(scopeOptions?.durable)) {
    return fallback;
  }

  const paramTypes = Reflect.getMetadata(PARAMTYPES_METADATA, cls) as unknown[] | undefined;
  if (cls.length > 0 && !paramTypes) {
    return fallback;
  }

  const baseTokens: unknown[] = [...(paramTypes ?? [])];
  while (baseTokens.length < cls.length) {
    baseTokens.push(undefined);
  }

  const selfDeclared = (Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, cls) ?? []) as Array<{
    index: number;
    param: unknown;
  }>;
  for (const { index, param } of selfDeclared) {
    baseTokens[index] = param;
  }

  for (const token of baseTokens) {
    if (token === undefined || token === null || isForwardRef(token)) {
      return fallback;
    }
  }

  const optionalIndices = new Set<number>((Reflect.getMetadata(OPTIONAL_DEPS_METADATA, cls) ?? []) as number[]);

  const depTokens: (InjectionToken | OptionalFactoryDependency)[] = baseTokens.map((token, idx) =>
    optionalIndices.has(idx) ? { token: token as InjectionToken, optional: true } : (token as InjectionToken),
  );

  return {
    provide: cls,
    useFactory: (envGetter: EnvGetterService, ...deps: unknown[]) =>
      envGetter.collectErrors(() => new cls(...deps), cls.name),
    inject: [EnvGetterService, ...depTokens],
  };
}

@Module({})
export class AppConfigModule {
  private static readonly featureCache = new Map<ClassConstructor, Map<boolean, DynamicModule>>();

  static forRoot(configClass: ClassConstructor, envGetter?: EnvGetterModuleOptions): DynamicModule;
  static forRoot(options: AppConfigModuleRootOptions): DynamicModule;
  static forRoot(
    configClassOrOptions: ClassConstructor | AppConfigModuleRootOptions,
    envGetter?: EnvGetterModuleOptions,
  ): DynamicModule {
    const options: AppConfigModuleRootOptions =
      typeof configClassOrOptions === "function" ? { useClass: configClassOrOptions, envGetter } : configClassOrOptions;

    loadEnvFromOptions(options.envGetter);

    const envGetterImport = options.envGetter ? EnvGetterModule.forRoot(options.envGetter) : EnvGetterModule;
    const configProvider = createConfigClassProvider(options.useClass, options.aggregateErrors);
    const aliasProvider: Provider = { provide: APP_CONFIG, useExisting: options.useClass };
    const additionalProviders = options.providers || [];

    return {
      module: AppConfigModule,
      global: true,
      imports: [envGetterImport, ...(options.imports || [])],
      providers: [configProvider, aliasProvider, ...additionalProviders],
      exports: [options.useClass, APP_CONFIG, ...additionalProviders],
    };
  }

  static forRootAsync(options: AppConfigModuleOptions): DynamicModule {
    loadEnvFromOptions(options.envGetter);

    const additionalProviders = options.providers || [];
    const envGetterImport = options.envGetter ? EnvGetterModule.forRoot(options.envGetter) : EnvGetterModule;

    if (options.useFactory) {
      const token = options.provide ?? APP_CONFIG;
      const inject = options.inject ?? [EnvGetterService];
      const provider: Provider = {
        provide: token,
        useFactory: options.useFactory,
        inject,
      };
      const aliasProviders: Provider[] = token !== APP_CONFIG ? [{ provide: APP_CONFIG, useExisting: token }] : [];
      const exportedTokens = token !== APP_CONFIG ? [token, APP_CONFIG] : [APP_CONFIG];

      return {
        module: AppConfigModule,
        global: true,
        imports: [envGetterImport, ...(options.imports || [])],
        providers: [provider, ...aliasProviders, ...additionalProviders],
        exports: [...exportedTokens, ...additionalProviders],
      };
    }

    if (options.useClass) {
      return this.forRoot({
        useClass: options.useClass,
        imports: options.imports,
        providers: options.providers,
        envGetter: options.envGetter,
        aggregateErrors: options.aggregateErrors,
      });
    }

    throw new Error("AppConfigModule.forRootAsync requires useClass or useFactory");
  }

  static forFeature(
    configs: ClassConstructor | ClassConstructor[],
    options?: { aggregateErrors?: boolean },
  ): DynamicModule {
    const aggregate = options?.aggregateErrors !== false;

    if (!Array.isArray(configs)) {
      return this.getSingleFeatureModule(configs, aggregate);
    }

    if (configs.length === 1) {
      return this.getSingleFeatureModule(configs[0]!, aggregate);
    }

    const subModules = configs.map((cls) => this.getSingleFeatureModule(cls, aggregate));
    return {
      module: AppConfigModule,
      imports: subModules,
      exports: subModules,
    };
  }

  static forTesting(
    configClass: ClassConstructor,
    env: Record<string, string | undefined>,
    options?: Omit<AppConfigModuleRootOptions, "useClass" | "envGetter"> & {
      configBaseDir?: string;
    },
  ): DynamicModule {
    const { configBaseDir, ...restOptions } = options ?? {};
    return this.forRoot({
      ...restOptions,
      useClass: configClass,
      envGetter: {
        env,
        envFilePath: false,
        configBaseDir,
      },
    });
  }

  private static getSingleFeatureModule(cls: ClassConstructor, aggregate: boolean): DynamicModule {
    let byAggregate = this.featureCache.get(cls);
    if (!byAggregate) {
      byAggregate = new Map<boolean, DynamicModule>();
      this.featureCache.set(cls, byAggregate);
    }

    const cached = byAggregate.get(aggregate);
    if (cached) {
      return cached;
    }

    const provider = createConfigClassProvider(cls, aggregate);
    const dynamicModule: DynamicModule = {
      module: AppConfigModule,
      providers: [provider],
      exports: [cls],
    };
    byAggregate.set(aggregate, dynamicModule);
    return dynamicModule;
  }
}
