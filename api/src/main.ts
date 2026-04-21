import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });

  // Enable CORS for Vercel and all origins (for WebRTC/socket.io)
  app.enableCors({
    origin: ['https://engagio-lms.vercel.app', 'https://engagio-lms-git-main-shaks21s-projects.vercel.app', 'https://engagio-api.loca.lt', 'https://engagio.duckdns.org', 'http://164.68.119.230:3001', 'http://164.68.119.230:3000', 'http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Initialize the app (setup routes, etc)
  await app.init();

  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}
bootstrap();
