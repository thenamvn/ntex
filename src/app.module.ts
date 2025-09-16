import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MqttService } from './mqtt/mqtt.service';
import { MqttModule } from './mqtt/mqtt.module';
import { AppGateway } from './app/app.gateway';
import { PushModule } from './push/push.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [DatabaseModule, MqttModule, PushModule, ApiModule],
  controllers: [AppController],
  providers: [AppService, AppGateway],
})
export class AppModule {}
