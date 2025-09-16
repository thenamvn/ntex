import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RestApiService } from './api.service';

@Controller()
export class ApiController {
  constructor(private readonly apiService: RestApiService) {}

  @Get('health')
  getHealth() {
    return this.apiService.getHealth();
  }

  @Post('feedback')
  postFeedback(@Body() body: { device_id: string; feedback: string }) {
    return this.apiService.saveFeedback(body);
  }

  @Get('device/:id/data')
  getDeviceData(@Param('id') id: string) {
    return this.apiService.getDeviceData(id);
  }
}