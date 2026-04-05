import { Module } from "@nestjs/common";
import { EngagementProcessor } from "./engagement.processor";

@Module({
  providers: [EngagementProcessor],
})
export class EngagementModule {}
