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
  private reconnectDelay = 5000;

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
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
    
    console.log(`🔄 Attempting to connect to MQTT broker: ${brokerUrl}`);
    
    this.client = mqtt.connect(brokerUrl, {
      clientId: `ntex-server-${Math.random().toString(16).slice(3)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 0,
      keepalive: 60,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
    });

    this.client.on('connect', () => {
      console.log('✅ Connected to MQTT broker');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.subscribeToTopic('iot/tag/data');
    });

    this.client.on('message', async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`📡 Received on ${topic}:`, data);
        
        await this.handleDockData(data);
      } catch (error) {
        console.error('❌ MQTT message parsing error:', error);
      }
    });

    this.client.on('error', (error) => {
      console.error('❌ MQTT connection error:', error.message);
      this.isConnected = false;
      this.handleReconnection();
    });

    this.client.on('disconnect', () => {
      console.log('📴 Disconnected from MQTT broker');
      this.isConnected = false;
    });

    this.client.on('offline', () => {
      console.log('📴 MQTT client is offline');
      this.isConnected = false;
      this.handleReconnection();
    });
  }

  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Stopping reconnection.');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connectMqtt();
      }
    }, this.reconnectDelay);
  }

  private async handleDockData(data: any) {
    try {
      // 1. Validate required fields
      if (!data.dock_id || !data.device_id) {
        console.error('❌ Missing dock_id or device_id in data');
        return;
      }

      // 2. Parse và validate data theo format mới
      const deviceData = {
        dock_id: data.dock_id,
        device_id: data.device_id,
        temperature: parseFloat(data.temperature) || 0,
        acceleration: Array.isArray(data.acceleration) ? data.acceleration : [0, 0, 0],
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
      
      // 5. Tạo payload gửi cho App
      const appPayload = {
        device_id: deviceData.device_id,
        temperature: deviceData.temperature,
        acceleration: deviceData.acceleration,
        battery: deviceData.battery,
        timestamp: deviceData.timestamp,
        alert: alert,
      };

      // 6. Broadcast qua WebSocket cho app online
      this.appGateway.broadcast(appPayload);

      // 7. Gửi FCM nếu có cảnh báo
      if (alert) {
        await this.sendPushNotification(deviceData, alert);
      }

      console.log(`✅ Processed data for device ${deviceData.device_id} from dock ${deviceData.dock_id}`);
    } catch (error) {
      console.error('❌ Error handling dock data:', error);
    }
  }

  private analyzeData(data: any): string | null {
    if (data.temperature > 38.0) {
      return 'high_temp';
    }
    if (data.battery < 20) {
      return 'low_battery';
    }
    if (data.audio_segment) {
      return 'crying_detected';
    }
    
    const acceleration = data.acceleration;
    if (acceleration && acceleration.length >= 3) {
      const magnitude = Math.sqrt(
        acceleration[0] ** 2 + acceleration[1] ** 2 + acceleration[2] ** 2
      );
      if (magnitude > 15) {
        return 'high_movement';
      }
    }

    return null;
  }

  private async sendPushNotification(data: any, alert: string) {
    try {
      // Query FCM tokens từ DB theo device_id
      const userDevices = await this.prisma.userDevice.findMany({
        where: { 
          device_id: data.device_id,
          is_active: true,
          fcm_token: { not: null }
        }
      });

      if (userDevices.length === 0) {
        console.log(`⚠️ No FCM tokens found for device ${data.device_id}`);
        return;
      }

      const alertMessages = {
        high_temp: `Bé ${data.device_id} sốt cao ${data.temperature}°C`,
        low_battery: `Pin Tag ${data.device_id} yếu (${data.battery}%)`,
        crying_detected: `Phát hiện tiếng khóc từ ${data.device_id}`,
        high_movement: `Chuyển động bất thường từ ${data.device_id}`,
      };

      const message = alertMessages[alert] || `Cảnh báo từ ${data.device_id}`;
      
      // Lưu alert vào DB
      const savedAlert = await this.prisma.alert.create({
        data: {
          device_id: data.device_id,
          alert_type: alert,
          message: message,
        }
      });

      // Gửi FCM cho tất cả các token
      const fcmPromises = userDevices.map(async (userDevice) => {
        if (!userDevice.fcm_token) return;
        
        try {
          await this.pushService.send(
            userDevice.fcm_token,
            'Cảnh báo sức khỏe',
            message,
            {
              device_id: data.device_id,
              alert_type: alert,
              alert_id: savedAlert.id.toString(),
              temperature: data.temperature.toString(),
            }
          );
          console.log(`📱 Push notification sent to user ${userDevice.user_id}`);
        } catch (error) {
          console.error(`❌ FCM send error for token ${userDevice.fcm_token}:`, error);
          
          if (error.code === 'messaging/registration-token-not-registered') {
            await this.prisma.userDevice.update({
              where: { id: userDevice.id },
              data: { fcm_token: null }
            });
          }
        }
      });

      await Promise.allSettled(fcmPromises);
      
      // Cập nhật trạng thái alert đã gửi
      await this.prisma.alert.update({
        where: { id: savedAlert.id },
        data: { is_sent: true }
      });

    } catch (error) {
      console.error('❌ Error in sendPushNotification:', error);
    }
  }

  async publishToTopic(topic: string, data: any) {
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

  private subscribeToTopic(topic: string) {
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
    return await this.publishToTopic(topic, {
      ...command,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  // Getter để check connection status
  get connected(): boolean {
    return this.isConnected;
  }
}