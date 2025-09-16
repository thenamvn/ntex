# Copilot Project Instruction

Bạn đang làm việc trong một dự án IoT với kiến trúc:

- Tag (ESP32, BLE Peripheral)
  - Thu thập sensor (temperature, acceleration, battery)
  - Mic + VAD để phát hiện tiếng khóc
  - Nén audio (Opus/ADPCM), gửi JSON qua BLE

- Dock (ESP32, BLE Central + Wi-Fi)
  - Nhận BLE data từ Tag
  - Ghép JSON/audio
  - Publish lên MQTT Broker (topic: `iot/tag/data`)

- Server (NestJS, Node.js)
  - Nhận dữ liệu từ Dock qua MQTT
  - Lưu DB (Postgres hoặc MongoDB)
  - Phân tích nâng cao, sinh cảnh báo
  - Phát realtime qua WebSocket cho App
  - Gửi push notification qua Firebase Cloud Messaging (FCM) khi app offline
  - Expose REST API (feedback từ App, health check, query data)

- App Mobile
  - Nhận realtime bằng WebSocket
  - Nhận cảnh báo khi offline qua FCM
  - Gửi feedback về server qua REST API

---

## Yêu cầu chính cho Copilot

1. **NestJS Server**
   - Module: 
     - `MqttModule` (dùng `mqtt.js` hoặc `@nestjs/microservices`)
     - `DatabaseModule` (TypeORM hoặc Mongoose)
     - `WebSocketGateway` cho realtime
     - `RestApiModule` (feedback, health check, device data)
     - `PushModule` (firebase-admin gửi FCM)
   - Khi MQTT nhận data:
     - Parse JSON
     - Lưu DB
     - Emit sang WebSocket Gateway
     - Nếu trigger cảnh báo → gửi FCM

2. **Entity mẫu (Postgres)**
   ```ts
   @Entity()
   export class DeviceData {
     @PrimaryGeneratedColumn()
     id: number;

     @Column()
     device_id: string;

     @Column("float")
     temperature: number;

     @Column("simple-array")
     acceleration: number[];

     @Column()
     battery: number;

     @Column("text", { nullable: true })
     audio_segment?: string;

     @CreateDateColumn()
     timestamp: Date;
   }
````

3. **WebSocket**

   * Tạo gateway đơn giản:

     ```ts
     @WebSocketGateway()
     export class AppGateway {
       @WebSocketServer()
       server: Server;

       broadcast(data: any) {
         this.server.emit("newData", data);
       }
     }
     ```

4. **REST API**

   * `POST /feedback { device_id, feedback }`
   * `GET /health`
   * (Optional) `GET /device/:id/data`

5. **Push Notification (FCM)**

   * Sử dụng `firebase-admin`
   * Hàm service: `send(token: string, title: string, body: string)`

---

## Coding style

* Viết code theo chuẩn NestJS module/service/controller.
* Sử dụng TypeScript.
* Tách module rõ ràng để dễ maintain.
* Code gọn, có comment ngắn giải thích.

```---
Hãy bắt đầu với việc tạo các module cơ bản và dần hoàn thiện theo yêu cầu trên nhé!