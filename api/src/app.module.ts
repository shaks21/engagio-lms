import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { IngestModule } from "./ingest/ingest.module";
import { ClassroomModule } from "./classroom/classroom.module";
import { EngagementModule } from "./engagement/engagement.module";
import { CourseModule } from "./course/course.module";
import { EnrollmentModule } from "./enrollment/enrollment.module";
import { SessionModule } from "./session/session.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { LivekitModule } from "./livekit/livekit.module";
import { PollsModule } from "./polls/polls.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TenancyModule,
    IngestModule,
    ClassroomModule,
    EngagementModule,
    CourseModule,
    EnrollmentModule,
    SessionModule,
    AnalyticsModule,
    LivekitModule,
    PollsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
