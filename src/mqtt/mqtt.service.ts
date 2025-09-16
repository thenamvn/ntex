import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class MqttService implements OnModuleInit {
  constructor(
    @Inject('MQTT_CLIENT') private client: ClientProxy, // Inject ClientProxy từ module
  ) {}

  async onModuleInit() {
    await this.client.connect(); // Kết nối MQTT broker
    console.log('Connected to MQTT broker via NestJS ClientProxy');
  }

  // Subscribe topic (NestJS dùng pattern, không subscribe trực tiếp)
  // Để listen, dùng trong gateway hoặc controller với send()
  async subscribeToTopic(topic: string) {
    // MQTT là pub/sub, NestJS khuyến dùng pattern để handle
    console.log(`Pattern set for ${topic} - handle in gateway if needed`);
  }

  // Publish message
  async publish(topic: string, payload: any) {
    return this.client.emit(topic, payload); // Emit event qua MQTT
  }

  // Nếu cần listen incoming, dùng trong AppGateway:
  // this.mqttService.client.send(pattern, {}).subscribe((data) => { ... });
}