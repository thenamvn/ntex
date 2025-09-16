# NTEX IoT Server

<p align="center">
  <a href="http://nestjs.com/" target="blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
  </a>
</p>

**Server backend cho hệ thống giám sát sức khỏe trẻ em thông qua IoT Tag & Dock**

## 🏗️ Kiến trúc hệ thống

```mermaid
flowchart TD
    subgraph Tag["Tag BLE"]
        T1[Sensor: Nhiệt độ, Gia tốc]
        T2[Mic + VAD: phát hiện tiếng khóc]
        T3[Gửi dữ liệu qua BLE]
    end

    subgraph Dock["Dock"]
        D1[Nhận BLE từ Tag]
        D2["Xử lý AI Edge<br/>(phân loại khóc, tư thế, sốt)"]
        D3[Nén audio khi cần]
        D4[Publish dữ liệu lên MQTT]
    end

    subgraph MQTT["MQTT Broker"]
        M1[Nhận data từ Dock]
        M2[Fanout cho subscriber]
    end

    subgraph Server["Server"]
        S1[Subscriber chính]
        S2[Lưu DB]
        S3[Phân tích nâng cao]
        S4[Sinh cảnh báo]
        S5["Gửi realtime → App<br/>(WebSocket)"]
        S6["Gửi push → App<br/>(FCM)"]
    end

    subgraph App["App Mobile"]
        A1["Nhận realtime<br/>(WebSocket)"]
        A2["Nhận cảnh báo<br/>(FCM background)"]
        A3["Gửi feedback → Server<br/>(REST/WebSocket)"]
    end

    subgraph Dev["Option Dev/Test"]
        AD["App sub MQTT<br/>(ít dùng production)"]
    end

    Tag --> Dock
    Dock --> MQTT
    MQTT --> Server
    MQTT --> Dev
    Server --> App
    App --> Server
```

## 🚀 Khởi chạy dự án

### Cài đặt dependencies
```bash
yarn install
```

### Thiết lập môi trường
```bash
# Copy file .env.example và điều chỉnh
cp .env.example .env
```

File .env:
```env
DATABASE_URL="postgres://username:password@host:port/database?sslmode=require"
MQTT_BROKER_URL="mqtt://broker.emqx.io:1883"
```

### Chạy database migrations
```bash
npx prisma migrate dev
npx prisma generate
```

### Khởi chạy server
```bash
# Development mode
yarn start:dev

# Production mode
yarn start:prod
```

Server sẽ chạy tại: `http://localhost:3000`

## 📡 MQTT Integration

Server lắng nghe topic: `iot/tag/data`

**Format dữ liệu từ Dock:**
```json
{
  "device_id": "TAG_001",
  "temperature": 37.5,
  "acceleration": [0.1, -0.2, 9.8],
  "battery": 85,
  "audio_segment": "base64_encoded_audio_or_null",
  "timestamp": 1694876400
}
```

**Gửi command xuống Tag/Dock:**
```javascript
// Topic: iot/tag/command/{device_id}
{
  "action": "feedback_received",
  "message": "Đã nhận phản hồi từ phụ huynh",
  "timestamp": 1694876500
}
```

## 🌐 REST API

### Health Check
```http
GET /api/health
```
**Response:**
```json
{
  "status": "ok",
  "uptime": 3600.123,
  "timestamp": "2025-09-16T12:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "mqtt": "connected"
  }
}
```

### MQTT Health
```http
GET /api/health/mqtt
```
**Response:**
```json
{
  "status": "connected",
  "timestamp": "2025-09-16T12:00:00.000Z"
}
```

### Gửi Feedback
```http
POST /api/feedback
Content-Type: application/json

{
  "device_id": "TAG_001",
  "feedback": "Bé đã ngủ ngon"
}
```
**Response:**
```json
{
  "status": "ok",
  "message": "Feedback saved successfully"
}
```

### Lấy dữ liệu thiết bị
```http
GET /api/device/TAG_001/data?limit=50
```
**Response:**
```json
[
  {
    "id": 1,
    "device_id": "TAG_001",
    "temperature": 37.5,
    "acceleration": [0.1, -0.2, 9.8],
    "battery": 85,
    "audio_segment": null,
    "timestamp": "2025-09-16T12:00:00.000Z"
  }
]
```

### Lấy dữ liệu theo khoảng thời gian
```http
GET /api/device/TAG_001/data/range?start=2025-09-16T00:00:00.000Z&end=2025-09-16T23:59:59.999Z
```

## 🔌 WebSocket (Real-time)

Kết nối: `ws://localhost:3000`

**Event nhận được:**
```javascript
// Khi có dữ liệu mới từ Tag
socket.on('newData', (data) => {
  console.log('Dữ liệu mới:', data);
  // data = { ...deviceData, alert: "Nguy cơ sốt cao" }
});
```

**Example client code (JavaScript):**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket');
});

socket.on('newData', (data) => {
  console.log('📡 New device data:', data);
  
  if (data.alert) {
    // Hiển thị cảnh báo trong app
    showAlert(data.alert, data);
  }
});

socket.on('disconnect', () => {
  console.log('📴 Disconnected from WebSocket');
});
```

## 📱 Push Notifications (FCM)

Server tự động gửi push notification khi:
- Nhiệt độ > 38.0°C → "Nguy cơ sốt cao"
- Pin < 20% → "Pin yếu"  
- Phát hiện audio → "Phát hiện tiếng khóc"

**Format notification:**
```json
{
  "title": "Cảnh báo sức khỏe",
  "body": "Bé TAG_001: Nguy cơ sốt cao. Nhiệt độ: 38.5°C"
}
```

## 📊 Database Schema (Prisma)

```prisma
model DeviceData {
  id            Int      @id @default(autoincrement())
  device_id     String
  temperature   Float
  acceleration  Json
  battery       Int
  audio_segment String?
  timestamp     DateTime @default(now())

  @@map("device_data")
}

model Feedback {
  id        Int      @id @default(autoincrement())
  device_id String
  feedback  String
  timestamp DateTime @default(now())

  @@map("feedback")
}
```

## 🧪 Testing

### Test MQTT với CLI
```bash
# Cài MQTT CLI
npm install -g mqtt

# Subscribe để xem data
mqtt_sub -h broker.emqx.io -p 1883 -t "iot/tag/data"

# Publish test data
mqtt_pub -h broker.emqx.io -p 1883 -t "iot/tag/data" -m '{
  "device_id": "TAG_001",
  "temperature": 39.0,
  "acceleration": [0.1, -0.2, 9.8],
  "battery": 15,
  "audio_segment": null,
  "timestamp": 1694876400
}'
```

### Test API với curl
```bash
# Health check
curl http://localhost:3000/api/health

# Send feedback
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"device_id": "TAG_001", "feedback": "Test feedback"}'

# Get device data
curl "http://localhost:3000/api/device/TAG_001/data?limit=10"
```

### Test WebSocket với wscat
```bash
# Cài wscat
npm install -g wscat

# Connect và lắng nghe
wscat -c ws://localhost:3000
```

## 🐳 Docker Development

```bash
# Start MQTT broker
docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto

# Start PostgreSQL
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ntex \
  -p 5432:5432 postgres:15
```

## 📂 Cấu trúc dự án

```
src/
├── api/                 # REST API module
│   ├── api.controller.ts
│   ├── api.service.ts
│   └── api.module.ts
├── database/            # Database & Prisma
│   ├── prisma.service.ts
│   └── database.module.ts
├── mqtt/                # MQTT client
│   ├── mqtt.service.ts
│   └── mqtt.module.ts
├── push/                # FCM push notifications
│   ├── push.service.ts
│   └── push.module.ts
├── websocket/           # WebSocket gateway
│   ├── app.gateway.ts
│   └── websocket.module.ts
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

## 🔧 Scripts

```bash
# Development
yarn start:dev          # Chạy với hot reload
yarn start:debug        # Chạy debug mode

# Production
yarn build              # Build project
yarn start:prod         # Chạy production

# Database
yarn prisma:generate    # Generate Prisma client
yarn prisma:migrate     # Chạy migrations
yarn prisma:studio      # Mở Prisma Studio

# Testing
yarn test               # Unit tests
yarn test:e2e           # End-to-end tests
yarn test:cov           # Test coverage
```

## 🐛 Troubleshooting

### MQTT connection issues
```bash
# Test broker connectivity
telnet broker.emqx.io 1883

# Check if port is open
nmap -p 1883 broker.emqx.io
```

### Database connection issues
```bash
# Test Postgres connection
psql "postgresql://username:password@host:port/database"

# Check if port is open
nmap -p 5432 your-db-host
```

### Common errors
- `ECONNRESET`: MQTT broker không khả dụng
- `P1001`: Database connection timeout
- `WebSocket failed`: Kiểm tra CORS settings

## 📝 Logs

Server log format:
```
🔄 Attempting to connect to MQTT broker: mqtt://broker.emqx.io:1883
✅ Connected to MQTT broker
📥 Subscribed to iot/tag/data
📡 Received on iot/tag/data: {"device_id":"TAG_001",...}
✅ Processed data for device TAG_001
📱 Push notification sent
```

## 🤝 Contributing

1. Fork project
2. Tạo feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Tạo Pull Request

## 📄 License

MIT Licensed. Xem file LICENSE để biết thêm chi tiết.

## 👥 Authors

- **NT Team** - *Initial work*

## 🔗 Links

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [MQTT.js Documentation](https://github.com/mqttjs/MQTT.js)
- [Socket.io Documentation](https://socket.io/docs/v4/)