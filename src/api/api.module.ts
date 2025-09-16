import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { RestApiService } from './api.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ApiController],
  providers: [RestApiService],
})
export class ApiModule {}