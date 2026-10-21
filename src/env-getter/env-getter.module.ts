import { Global, Module, DynamicModule } from "@nestjs/common";
import { EnvGetterService } from "./env-getter.service";
import { type EnvGetterModuleOptions, ENV_GETTER_OPTIONS } from "./types";
import { loadEnvFromOptions } from "./load-env-from-options";

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`).join(",")}}`;
}

@Global()
@Module({ providers: [EnvGetterService], exports: [EnvGetterService] })
export class EnvGetterModule {
  private static readonly rootCache = new Map<string, DynamicModule>();

  /**
   * Configure EnvGetterModule with options (env-file path(s), configBaseDir, etc.).
   * The plain `imports: [EnvGetterModule]` form continues to work with defaults.
   * @param options - Startup options for `EnvGetterService` (see `EnvGetterModuleOptions`).
   * @returns A global dynamic module providing the configured `EnvGetterService`.
   */
  static forRoot(options: EnvGetterModuleOptions): DynamicModule {
    loadEnvFromOptions(options);

    if (options.env !== undefined) {
      return {
        module: EnvGetterModule,
        global: true,
        providers: [{ provide: ENV_GETTER_OPTIONS, useValue: options }, EnvGetterService],
        exports: [EnvGetterService],
      };
    }

    const cacheKey = stableSerialize(options);
    const cached = this.rootCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const dynamicModule: DynamicModule = {
      module: EnvGetterModule,
      global: true,
      providers: [{ provide: ENV_GETTER_OPTIONS, useValue: options }, EnvGetterService],
      exports: [EnvGetterService],
    };
    this.rootCache.set(cacheKey, dynamicModule);
    return dynamicModule;
  }
}
