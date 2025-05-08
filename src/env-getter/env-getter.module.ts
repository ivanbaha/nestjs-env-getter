import { Global, Module } from "@nestjs/common";
import { EnvGetterService } from "./env-getter.service";

@Global()
@Module({ providers: [EnvGetterService], exports: [EnvGetterService] })
export class EnvGetterModule {}
