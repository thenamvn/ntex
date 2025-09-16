import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { RestApiService } from './api.service';
import { DatabaseModule } from '../database/database.module';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [DatabaseModule, MqttModule],
  controllers: [ApiController],
  providers: [RestApiService],
})
export class ApiModule {}