import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class RestApiService {
  constructor(
    private prisma: PrismaService,
    private mqttService: MqttService,
  ) {}

  getHealth() {
    return { 
      status: 'ok', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        mqtt: this.mqttService.connected ? 'connected' : 'disconnected',
      }
    };
  }

  getMqttHealth() {
    return {
      status: this.mqttService.connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }

  async saveFeedback(body: { device_id: string; feedback: string }) {
    console.log(`📝 Feedback from app for ${body.device_id}: ${body.feedback}`);
    
    // Gửi command về Tag/Dock nếu MQTT connected
    if (this.mqttService.connected) {
      await this.mqttService.sendCommand(body.device_id, {
        action: 'feedback_received',
        message: body.feedback,
      });
    }

    return { status: 'ok', message: 'Feedback saved successfully' };
  }

  async getDeviceData(deviceId: string, limit = 50) {
    return this.prisma.deviceData.findMany({
      where: { device_id: deviceId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async getDeviceDataByTimeRange(
    deviceId: string, 
    startTime: Date, 
    endTime: Date
  ) {
    return this.prisma.deviceData.findMany({
      where: {
        device_id: deviceId,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }
}