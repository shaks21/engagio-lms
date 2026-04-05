import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TenantGuard } from "./tenant.guard";

@Module({
  imports: [PrismaModule],
  providers: [TenantGuard],
  exports: [TenantGuard],
})
export class TenancyModule {}
