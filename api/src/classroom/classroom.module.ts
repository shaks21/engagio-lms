import { Module } from "@nestjs/common";
import { ClassroomGateway } from "./classroom.gateway";
import { IngestModule } from "../ingest/ingest.module";

@Module({
  imports: [IngestModule],
  providers: [ClassroomGateway],
  exports: [ClassroomGateway],
})
export class ClassroomModule {}
