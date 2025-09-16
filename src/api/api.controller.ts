import { Controller, Get, Post, Body, Param, Query, Put} from '@nestjs/common';
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

    @Post('device/register')
  registerDevice(@Body() body: { 
    user_id: string; 
    device_id: string; 
    dock_id?: string;
    fcm_token: string;
    device_name?: string;
  }) {
    return this.apiService.registerDevice(body);
  }

  @Put('device/fcm-token')
  updateFcmToken(@Body() body: { 
    user_id: string; 
    device_id: string; 
    fcm_token: string;
  }) {
    return this.apiService.updateFcmToken(body);
  }

  @Get('device/:id/alerts')
  getDeviceAlerts(
    @Param('id') deviceId: string,
    @Query('limit') limit?: string,
  ) {
    return this.apiService.getDeviceAlerts(deviceId, limit ? parseInt(limit) : 50);
  }

  @Put('alert/:id/read')
  markAlertAsRead(@Param('id') alertId: string) {
    return this.apiService.markAlertAsRead(parseInt(alertId));
  }
}