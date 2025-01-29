import { Module } from "@nestjs/common";
import { EnvGetterService } from "./env-getter.service";

@Module({
  providers: [EnvGetterService],
  exports: [EnvGetterService],
})
export class EnvGetterModule {}
