import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RestApiService {
  constructor(private prisma: PrismaService) {}

  getHealth() {
    return { status: 'ok', uptime: process.uptime() };
  }

  async saveFeedback(body: { device_id: string; feedback: string }) {
    // Save feedback to DB or handle as needed
    return { status: 'ok' };
  }

  async getDeviceData(deviceId: string) {
    return this.prisma.deviceData.findMany({
      where: { device_id: deviceId },
    });
  }
}