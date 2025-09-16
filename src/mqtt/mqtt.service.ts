import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { PrismaService } from '../database/prisma.service';
import { AppGateway } from '../websocket/app.gateway';
import { PushService } from '../push/push.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(
    private prisma: PrismaService,
    private appGateway: AppGateway,
    private pushService: PushService,
  ) {}

  onModuleInit() {
    this.connectMqtt();
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end();
    }
  }

  private connectMqtt() {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org:1883';
    
    console.log(`🔄 Attempting to connect to MQTT broker: ${brokerUrl}`);
    
    this.client = mqtt.connect(brokerUrl, {
      clientId: `ntex-server-${Math.random().toString(16).slice(3)}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 5000,
      keepalive: 60,
    });

    this.client.on('connect', () => {
      console.log('✅ Connected to MQTT broker');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.subscribe('iot/tag/data');
    });

    this.client.on('message', async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`📡 Received on ${topic}:`, data);
        
        await this.handleDeviceData(data);
      } catch (error) {
        console.error('❌ MQTT message parsing error:', error);
      }
    });

    this.client.on('error', (error) => {
      console.error('❌ MQTT connection error:', error.message);
      this.isConnected = false;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached. Stopping reconnection.');
        this.client.end();
      } else {
        this.reconnectAttempts++;
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      }
    });

    this.client.on('disconnect', () => {
      console.log('📴 Disconnected from MQTT broker');
      this.isConnected = false;
    });

    this.client.on('reconnect', () => {
      console.log('🔄 Reconnecting to MQTT broker...');
    });

    this.client.on('offline', () => {
      console.log('📴 MQTT client is offline');
      this.isConnected = false;
    });
  }

  private async handleDeviceData(data: any) {
    try {
      // 1. Validate data
      if (!data.device_id) {
        console.error('❌ Missing device_id in data');
        return;
      }

      // 2. Parse và validate data
      const deviceData = {
        device_id: data.device_id,
        temperature: parseFloat(data.temperature) || 0,
        acceleration: Array.isArray(data.acceleration) ? data.acceleration : [],
        battery: parseInt(data.battery) || 0,
        audio_segment: data.audio_segment || null,
        timestamp: data.timestamp ? new Date(data.timestamp * 1000) : new Date(),
      };

      // 3. Lưu vào database
      const savedData = await this.prisma.deviceData.create({
        data: deviceData,
      });

      // 4. Phân tích và tạo cảnh báo
      const alert = this.analyzeData(deviceData);
      const broadcastData = { ...savedData, alert };

      // 5. Broadcast qua WebSocket cho app online
      this.appGateway.broadcast(broadcastData);

      // 6. Gửi FCM nếu có cảnh báo
      if (alert) {
        await this.sendPushNotification(deviceData, alert);
      }

      console.log(`✅ Processed data for device ${deviceData.device_id}`);
    } catch (error) {
      console.error('❌ Error handling device data:', error);
    }
  }

  private analyzeData(data: any): string | null {
    // Logic phân tích dữ liệu
    if (data.temperature > 38.0) {
      return 'Nguy cơ sốt cao';
    }
    if (data.battery < 20) {
      return 'Pin yếu';
    }
    if (data.audio_segment) {
      return 'Phát hiện tiếng khóc';
    }
    return null;
  }

  private async sendPushNotification(data: any, alert: string) {
    // Trong thực tế, cần query FCM token từ DB theo device_id
    const fcmToken = 'EXAMPLE_FCM_TOKEN'; // TODO: Lấy từ DB
    
    try {
      await this.pushService.send(
        fcmToken,
        'Cảnh báo sức khỏe',
        `Bé ${data.device_id}: ${alert}. Nhiệt độ: ${data.temperature}°C`
      );
      console.log('📱 Push notification sent');
    } catch (error) {
      console.error('❌ FCM send error:', error);
    }
  }

  async publish(topic: string, data: any) {
    if (!this.isConnected) {
      console.warn('⚠️ MQTT not connected, cannot publish');
      return false;
    }

    try {
      this.client.publish(topic, JSON.stringify(data));
      console.log(`📤 Published to ${topic}:`, data);
      return true;
    } catch (error) {
      console.error('❌ Publish error:', error);
      return false;
    }
  }

  async subscribe(topic: string) {
    if (!this.isConnected) {
      console.warn('⚠️ MQTT not connected, cannot subscribe');
      return;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error('❌ Subscribe error:', err);
      } else {
        console.log(`📥 Subscribed to ${topic}`);
      }
    });
  }

  // Method để gửi command xuống Tag/Dock
  async sendCommand(deviceId: string, command: any) {
    const topic = `iot/tag/command/${deviceId}`;
    return await this.publish(topic, {
      ...command,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  // Getter để check connection status
  get connected(): boolean {
    return this.isConnected;
  }
}