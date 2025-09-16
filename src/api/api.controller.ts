import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { RestApiService } from './api.service';

@Controller('api')
export class ApiController {
  constructor(private readonly apiService: RestApiService) {}

  @Get('health')
  getHealth() {
    return this.apiService.getHealth();
  }

  @Get('health/mqtt')
  getMqttHealth() {
    return this.apiService.getMqttHealth();
  }

  @Post('feedback')
  postFeedback(@Body() body: { device_id: string; feedback: string }) {
    return this.apiService.saveFeedback(body);
  }

  @Get('device/:id/data')
  getDeviceData(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.apiService.getDeviceData(id, limit ? parseInt(limit) : 50);
  }

  @Get('device/:id/data/range')
  getDeviceDataByRange(
    @Param('id') id: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.apiService.getDeviceDataByTimeRange(
      id,
      new Date(start),
      new Date(end),
    );
  }
}