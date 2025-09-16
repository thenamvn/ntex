import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MqttModule } from './mqtt/mqtt.module';
import { WebSocketModule } from './websocket/websocket.module';
import { PushModule } from './push/push.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [
    DatabaseModule, 
    MqttModule, 
    WebSocketModule, 
    PushModule, 
    ApiModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}