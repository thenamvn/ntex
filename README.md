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

**Format dữ liệu từ Dock (Updated):**
```json
{
  "dock_id": "DOCK-001",               // Định danh Dock
  "device_id": "TAG-001",              // Định danh Tag
  "timestamp": 1724572800,             // Unix epoch
  "temperature": 36.5,                 // °C
  "acceleration": [0.1, -0.2, 9.8],    // raw sensor data
  "battery": 85,                       // %
  "audio_segment": "BASE64_STRING"     // optional (chỉ khi VAD trigger)
}
```

**Server Workflow:**
1. 📥 **MQTT Subscribe** → Nhận data từ Dock
2. 📊 **Data Processing** → Parse, validate, normalize
3. 🗄️ **Database Storage** → Lưu vào TimescaleDB (Postgres)
4. 🔍 **Alert Analysis** → Phân tích business rules
5. 🌐 **WebSocket Broadcast** → Realtime cho app online
6. 📱 **FCM Push** → Notification cho app offline
7. 📝 **Alert Logging** → Lưu lịch sử cảnh báo

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

### Đăng ký Device & FCM Token (New)
```http
POST /api/device/register
Content-Type: application/json

{
  "user_id": "user123",
  "device_id": "TAG-001", 
  "dock_id": "DOCK-001",
  "fcm_token": "fcm_token_here",
  "device_name": "Tag của bé An"
}
```

### Cập nhật FCM Token (New)
```http
PUT /api/device/fcm-token
Content-Type: application/json

{
  "user_id": "user123",
  "device_id": "TAG-001",
  "fcm_token": "new_fcm_token"
}
```

### Lấy danh sách Alerts (New)
```http
GET /api/device/TAG-001/alerts?limit=50
```
**Response:**
```json
[
  {
    "id": 1,
    "device_id": "TAG-001",
    "alert_type": "high_temp",
    "message": "Bé TAG-001 sốt cao 38.5°C",
    "is_sent": true,
    "is_read": false,
    "timestamp": "2025-09-16T12:00:00.000Z"
  }
]
```

### Đánh dấu Alert đã đọc (New)
```http
PUT /api/alert/1/read
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

### Lấy dữ liệu thiết bị
```http
GET /api/device/TAG_001/data?limit=50
```
**Response:**
```json
[
  {
    "id": 1,
    "dock_id": "DOCK-001",
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

## 📱 Push Notifications (FCM) - Enhanced

**Alert Types & Triggers:**
- `high_temp`: Nhiệt độ > 38.0°C → "Bé TAG-001 sốt cao 38.5°C"
- `low_battery`: Pin < 20% → "Pin Tag TAG-001 yếu (15%)"
- `crying_detected`: Audio segment detected → "Phát hiện tiếng khóc từ TAG-001"
- `high_movement`: Acceleration > 15g → "Chuyển động bất thường từ TAG-001"

**FCM Token Management:**
- 📝 App đăng ký FCM token qua API `/device/register`
- 🔄 Auto cleanup invalid tokens
- 👥 Multi-user support (1 device có thể có nhiều FCM tokens)
- 📊 Track notification delivery status

**FCM Payload Format:**
```json
{
  "notification": {
    "title": "Cảnh báo sức khỏe",
    "body": "Bé TAG-001: Nguy cơ sốt cao. Nhiệt độ: 38.5°C"
  },
  "data": {
    "device_id": "TAG-001",
    "alert_type": "high_temp", 
    "alert_id": "123",
    "temperature": "38.5"
  }
}
```

## 📊 Database Schema (Prisma) - Updated

```prisma
model DeviceData {
  id             Int      @default(autoincrement())
  dock_id        String   // Định danh Dock
  device_id      String   // Định danh Tag  
  temperature    Float
  acceleration   Float[]
  battery        Int
  audio_segment  String?  // Base64 compressed audio
  timestamp      DateTime @default(now())
  
  @@id([id, timestamp])
  @@index([device_id, timestamp])
  @@index([dock_id, timestamp])
  @@map("DeviceData")
}

model UserDevice {
  id          Int      @id @default(autoincrement())
  user_id     String   // ID phụ huynh
  device_id   String   // ID của Tag
  dock_id     String?  // ID của Dock (optional)
  fcm_token   String?  // FCM token
  device_name String?  // Tên thiết bị
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  
  @@unique([user_id, device_id])
  @@map("UserDevice")
}

model Alert {
  id         Int      @id @default(autoincrement())
  device_id  String
  alert_type String   // high_temp, low_battery, crying_detected, high_movement
  message    String
  is_sent    Boolean  @default(false)  // Đã gửi FCM chưa
  is_read    Boolean  @default(false)  // User đã xem chưa
  timestamp  DateTime @default(now())
  
  @@index([device_id, timestamp])
  @@map("Alert")
}

model Feedback {
  id        Int      @id @default(autoincrement())
  device_id String
  feedback  String
  timestamp DateTime @default(now())

  @@map("Feedback")
}
```

**Database Features:**
- 🕐 **TimescaleDB**: Tối ưu time-series data cho IoT
- 📈 **Hypertables**: Auto partitioning theo timestamp
- 🔍 **Indexing**: Optimized queries cho device_id + timestamp
- 🗂️ **Multi-tenant**: Support nhiều user/device

## 🔄 Server Workflow Chi Tiết

### 1. Khởi động Server
```mermaid
graph TD
    A[Server Start] --> B[Init Database Connection]
    B --> C[Init Firebase Admin SDK]
    C --> D[Connect MQTT Broker]
    D --> E[Subscribe iot/tag/data]
    E --> F[Start WebSocket Server]
    F --> G[Start REST API]
    G --> H[✅ Server Ready]
```

### 2. Data Processing Pipeline
```mermaid
sequenceDiagram
    participant D as Dock
    participant M as MQTT Broker
    participant S as Server
    participant DB as Database
    participant WS as WebSocket
    participant FCM as Firebase

    D->>M: Publish iot/tag/data
    M->>S: Forward message
    S->>S: Parse & Validate JSON
    S->>DB: Save DeviceData
    S->>S: Analyze Rules (temp, battery, audio)
    
    alt Alert Generated
        S->>DB: Save Alert record
        S->>FCM: Send Push Notification
        S->>WS: Broadcast with alert
    else No Alert
        S->>WS: Broadcast normal data
    end
```

### 3. Real-time Communication Flow
```mermaid
graph LR
    subgraph "App States"
        A1[App Online]
        A2[App Background]
        A3[App Closed]
    end
    
    subgraph "Server Response"
        S1[WebSocket Broadcast]
        S2[FCM Push Only]
        S3[FCM Push + Store Alert]
    end
    
    A1 --> S1
    A2 --> S2
    A3 --> S3
```

### 4. Error Handling & Resilience
- **MQTT Reconnection**: Exponential backoff, max 5 attempts
- **Database Retry**: Auto-retry với Prisma connection pool
- **FCM Token Cleanup**: Auto-remove invalid tokens
- **WebSocket Recovery**: Client auto-reconnect
- **Data Validation**: Strict schema validation trước khi lưu DB

## 🔧 Configuration & Environment

### Required Environment Variables
```env
# Database (TimescaleDB/PostgreSQL)
DATABASE_URL="postgres://user:pass@host:port/db?sslmode=require"

# MQTT Broker
MQTT_BROKER_URL="mqtt://broker.emqx.io:1883"
MQTT_USERNAME=""  # optional
MQTT_PASSWORD=""  # optional

# Server
PORT=3000
NODE_ENV=production

# Firebase (cho FCM)
# Cần file token/serviceAccountKey.json
```

### Firebase Setup
1. Tạo Firebase project tại https://console.firebase.google.com
2. Generate Service Account Key
3. Download file JSON và đặt tại `token/serviceAccountKey.json`
4. Enable Cloud Messaging API

### MQTT Broker Options
```bash
# Public brokers (development)
mqtt://broker.emqx.io:1883
mqtt://test.mosquitto.org:1883  
mqtt://mqtt.eclipseprojects.io:1883

# Self-hosted (production)
docker run -d -p 1883:1883 eclipse-mosquitto
```

## 🧪 Testing - Comprehensive

### Test MQTT với CLI
```bash
# Cài MQTT CLI
npm install -g mqtt

# Subscribe để xem data
mqtt sub -h broker.emqx.io -p 1883 -t "iot/tag/data"

# Publish test data với format mới
mqtt pub -h broker.emqx.io -p 1883 -t "iot/tag/data" -m '{
  "dock_id": "DOCK-001",
  "device_id": "TAG-001",
  "timestamp": 1724572800,
  "temperature": 38.5,
  "acceleration": [0.1, -0.2, 9.8],
  "battery": 15,
  "audio_segment": null
}'

# Test với audio alert
mqtt pub -h broker.emqx.io -p 1883 -t "iot/tag/data" -m '{
  "dock_id": "DOCK-001", 
  "device_id": "TAG-001",
  "timestamp": 1724572900,
  "temperature": 37.0,
  "acceleration": [0.0, 0.0, 9.8],
  "battery": 80,
  "audio_segment": "SGVsbG8gV29ybGQ="
}'
```

### Test REST API với curl
```bash
# Health checks
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/mqtt

# Register device & FCM token
curl -X POST http://localhost:3000/api/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "device_id": "TAG-001",
    "dock_id": "DOCK-001", 
    "fcm_token": "test_fcm_token",
    "device_name": "Tag của bé An"
  }'

# Update FCM token
curl -X PUT http://localhost:3000/api/device/fcm-token \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "device_id": "TAG-001",
    "fcm_token": "new_fcm_token"
  }'

# Get device data
curl "http://localhost:3000/api/device/TAG-001/data?limit=10"

# Get alerts
curl "http://localhost:3000/api/device/TAG-001/alerts?limit=10"

# Mark alert as read
curl -X PUT http://localhost:3000/api/alert/1/read

# Send feedback
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"device_id": "TAG-001", "feedback": "Test feedback"}'
```

### Test WebSocket với Node.js
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket');
});

socket.on('newData', (data) => {
  console.log('📡 Received data:', data);
  if (data.alert) {
    console.log('🚨 Alert:', data.alert);
  }
});

socket.on('disconnect', () => {
  console.log('📴 Disconnected');
});
```

### End-to-End Test Scenario
1. **Start Server**: `yarn start:dev`
2. **Connect WebSocket**: Chạy test client
3. **Publish MQTT**: Gửi test data với temperature > 38°C
4. **Verify Pipeline**:
   - ✅ Data saved in database
   - ✅ Alert generated
   - ✅ WebSocket broadcast received
   - ✅ FCM notification attempted
   - ✅ Alert logged in database

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

## 🔧 Scripts - Complete List

```bash
# Development
yarn start:dev          # Chạy với hot reload + file watching
yarn start:debug        # Chạy debug mode (port 9229)
yarn start              # Chạy production build locally

# Production 
yarn build              # Build TypeScript → JavaScript
yarn start:prod         # Chạy production (cần build trước)

# Database & Prisma
yarn prisma:generate    # Generate Prisma client
yarn prisma:migrate     # Tạo migration mới
yarn prisma:deploy      # Apply migrations (production)
yarn prisma:studio      # Mở Prisma Studio GUI
yarn prisma:reset       # Reset database (development only)
yarn prisma:seed        # Chạy database seeding

# Testing
yarn test               # Unit tests với Jest
yarn test:watch         # Jest watch mode
yarn test:e2e           # End-to-end tests
yarn test:cov           # Test coverage report
yarn test:debug         # Debug tests

# Code Quality
yarn lint               # ESLint check
yarn lint:fix           # Auto-fix ESLint issues
yarn format             # Prettier format
yarn type-check         # TypeScript type checking

# Docker
yarn docker:build       # Build Docker image
yarn docker:run         # Run container locally
yarn docker:compose     # Start với docker-compose
```

## 📦 Dependencies Summary

### Core Dependencies
- **NestJS**: Framework backend
- **Prisma**: ORM & database toolkit
- **MQTT.js**: MQTT client
- **Socket.io**: WebSocket server
- **Firebase Admin**: FCM push notifications

### Database
- **PostgreSQL**: Primary database
- **TimescaleDB**: Time-series extension

### Development Tools
- **TypeScript**: Type safety
- **Jest**: Testing framework
- **ESLint + Prettier**: Code quality
- **Nodemon**: Hot reload

## 🐛 Troubleshooting

## 🐛 Troubleshooting - Extended

### MQTT Connection Issues
```bash
# Test broker connectivity
telnet broker.emqx.io 1883

# Check if port is open
nmap -p 1883 broker.emqx.io

# Test with different brokers
mqtt sub -h test.mosquitto.org -p 1883 -t "test/topic"
mqtt sub -h mqtt.eclipseprojects.io -p 1883 -t "test/topic"
```

### Database Issues
```bash
# Test TimescaleDB connection
psql "postgresql://username:password@host:port/database"

# Check TimescaleDB extension
psql -c "SELECT * FROM timescaledb_information.hypertables;"

# Verify migrations
npx prisma migrate status

# Reset database if needed
npx prisma migrate reset --force
```

### Firebase/FCM Issues
```bash
# Verify service account key
node -e "console.log(require('./token/serviceAccountKey.json').project_id)"

# Test Firebase connection
curl -X POST https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"message":{"token":"test","notification":{"title":"Test"}}}'
```

### Common Error Codes & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNRESET` | MQTT broker unavailable | Try different broker or check network |
| `P1001` | Database timeout | Check connection string & network |
| `messaging/registration-token-not-registered` | Invalid FCM token | Token auto-cleanup implemented |
| `ValidationError` | Invalid data format | Check MQTT payload schema |
| `TimescaleDB not found` | Extension not enabled | Run `CREATE EXTENSION timescaledb;` |

### Performance Monitoring
```sql
-- Check database performance
SELECT COUNT(*) FROM "DeviceData" WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Monitor hypertable chunks
SELECT chunk_name, range_start, range_end 
FROM timescaledb_information.chunks 
WHERE hypertable_name = 'DeviceData' 
ORDER BY range_start DESC LIMIT 10;

-- Alert statistics
SELECT alert_type, COUNT(*), AVG(CASE WHEN is_sent THEN 1 ELSE 0 END) as success_rate
FROM "Alert" 
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY alert_type;
```

## 📝 Logs - Enhanced Format

**Server Startup:**
```
🔄 Starting NTEX IoT Server...
✅ Database connected (TimescaleDB)
✅ Firebase Admin SDK initialized  
🔄 Attempting to connect to MQTT broker: mqtt://broker.emqx.io:1883
✅ Connected to MQTT broker
📥 Subscribed to iot/tag/data
🌐 WebSocket server started on port 3000
📡 REST API server started on port 3000
🚀 Server ready - All systems operational
```

**Data Processing:**
```
📡 Received on iot/tag/data: {"dock_id":"DOCK-001","device_id":"TAG-001",...}
📊 Processing data for device TAG-001 from dock DOCK-001
💾 Data saved to database (ID: 1234)
🔍 Alert analysis: temperature=38.5°C → high_temp alert generated
📝 Alert saved (ID: 567): "Bé TAG-001 sốt cao 38.5°C"
📱 FCM notification sent to 2 users
🌐 WebSocket broadcast: {"device_id":"TAG-001","alert":"high_temp",...}
✅ Processing completed in 45ms
```

**Error Handling:**
```
❌ MQTT connection error: ECONNRESET
🔄 Reconnection attempt 1/5 in 1000ms
⚠️ No FCM tokens found for device TAG-002
❌ FCM send error for token abc123: messaging/registration-token-not-registered
🧹 Cleaned up invalid FCM token for user456
```

**Health Monitoring:**
```
📊 Health Check - All systems: OK
  ├─ Database: ✅ Connected (TimescaleDB)
  ├─ MQTT: ✅ Connected (broker.emqx.io)
  ├─ Firebase: ✅ Initialized
  ├─ WebSocket: ✅ 3 clients connected
  └─ Uptime: 3h 45m 12s
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