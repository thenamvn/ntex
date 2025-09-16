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

    async registerDevice(data: { 
    user_id: string; 
    device_id: string; 
    dock_id?: string;
    fcm_token: string;
    device_name?: string;
  }) {
    const userDevice = await this.prisma.userDevice.upsert({
      where: {
        user_id_device_id: {
          user_id: data.user_id,
          device_id: data.device_id,
        }
      },
      update: {
        fcm_token: data.fcm_token,
        dock_id: data.dock_id,
        device_name: data.device_name,
        is_active: true,
        updated_at: new Date(),
      },
      create: {
        user_id: data.user_id,
        device_id: data.device_id,
        dock_id: data.dock_id,
        fcm_token: data.fcm_token,
        device_name: data.device_name,
      }
    });

    console.log(`📱 Device registered: ${data.device_id} for user ${data.user_id}`);
    return { status: 'ok', message: 'Device registered successfully', data: userDevice };
  }

  async updateFcmToken(data: { user_id: string; device_id: string; fcm_token: string }) {
    await this.prisma.userDevice.updateMany({
      where: {
        user_id: data.user_id,
        device_id: data.device_id,
      },
      data: {
        fcm_token: data.fcm_token,
        updated_at: new Date(),
      }
    });

    return { status: 'ok', message: 'FCM token updated successfully' };
  }

  async getDeviceAlerts(deviceId: string, limit = 50) {
    return this.prisma.alert.findMany({
      where: { device_id: deviceId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async markAlertAsRead(alertId: number) {
    await this.prisma.alert.update({
      where: { id: alertId },
      data: { is_read: true }
    });

    return { status: 'ok', message: 'Alert marked as read' };
  }
}