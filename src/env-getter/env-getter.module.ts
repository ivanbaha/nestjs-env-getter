import { Global, Module, DynamicModule } from "@nestjs/common";
import { EnvGetterService } from "./env-getter.service";
import { type EnvGetterModuleOptions, ENV_GETTER_OPTIONS } from "./types";

@Global()
@Module({ providers: [EnvGetterService], exports: [EnvGetterService] })
export class EnvGetterModule {
  /**
   * Configure EnvGetterModule with options (env-file path(s), configBaseDir, etc.).
   * The plain `imports: [EnvGetterModule]` form continues to work with defaults.
   * @param options - Startup options for `EnvGetterService` (see `EnvGetterModuleOptions`).
   * @returns A global dynamic module providing the configured `EnvGetterService`.
   */
  static forRoot(options: EnvGetterModuleOptions): DynamicModule {
    return {
      module: EnvGetterModule,
      global: true,
      providers: [{ provide: ENV_GETTER_OPTIONS, useValue: options }, EnvGetterService],
      exports: [EnvGetterService],
    };
  }
}
