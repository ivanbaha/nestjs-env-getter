import { Injectable } from "@nestjs/common";
import { EnvGetterService } from "../env-getter/env-getter.service";

/** Base class for config classes: enables field initializers with full type inference. */
@Injectable()
export abstract class EnvConfig {
  constructor(protected readonly envGetter: EnvGetterService) {}
}
