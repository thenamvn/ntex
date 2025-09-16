import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';  // Add this import

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));  // Add this line to enable Socket.IO
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();