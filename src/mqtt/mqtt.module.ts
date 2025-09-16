import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { DatabaseModule } from '../database/database.module';
import { PushModule } from '../push/push.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [DatabaseModule, PushModule, WebSocketModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}