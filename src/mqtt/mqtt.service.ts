import { Injectable, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';

@Injectable()
export class MqttService implements OnModuleInit {
  private client: mqtt.MqttClient;

  constructor() {
    this.client = mqtt.connect('mqtt://localhost:1883'); // Thay bằng URL broker thực tế
  }

  onModuleInit() {
    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
    });

    this.client.on('message', (topic, message) => {
      // Xử lý message nhận được (parse JSON, lưu DB, emit WebSocket, gửi FCM nếu cần)
      const data = JSON.parse(message.toString());
      console.log(`Received on ${topic}:`, data);
      // TODO: Integrate with DatabaseService, AppGateway, PushService
    });
  }

  async publish(topic: string, data: any) {
    this.client.publish(topic, JSON.stringify(data));
  }

  async subscribe(topic: string) {
    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error('Subscribe error:', err);
      } else {
        console.log(`Subscribed to ${topic}`);
      }
    });
  }
}