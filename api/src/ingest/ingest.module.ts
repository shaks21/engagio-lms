import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { IngestService } from "./ingest.service";

@Module({
  imports: [
    ClientsModule.register([
      {
        name: "KAFKA_CLIENT",
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
          },
        },
      },
    ]),
  ],
  providers: [IngestService],
  exports: [IngestService],
})
export class IngestModule {}
