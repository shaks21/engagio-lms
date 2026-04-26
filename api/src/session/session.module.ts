import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";
import { BreakoutController } from "./breakout.controller";
import { BreakoutService } from "./breakout.service";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SessionController, BreakoutController],
  providers: [SessionService, BreakoutService],
  exports: [SessionService, BreakoutService],
})
export class SessionModule {}
