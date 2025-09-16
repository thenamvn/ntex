import { 
  WebSocketGateway, 
  WebSocketServer, 
  OnGatewayConnection, 
  OnGatewayDisconnect 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // Trong production nên chỉ định domain cụ thể
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Set<Socket>();

  handleConnection(client: Socket) {
    this.connectedClients.add(client);
    console.log(`🔌 Client connected: ${client.id}, Total: ${this.connectedClients.size}`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client);
    console.log(`🔌 Client disconnected: ${client.id}, Total: ${this.connectedClients.size}`);
  }

  broadcast(data: any) {
    console.log(`📡 Broadcasting to ${this.connectedClients.size} clients:`, data);
    this.server.emit('newData', data);
  }

  // Method để gửi data cho device cụ thể
  broadcastToDevice(deviceId: string, data: any) {
    this.server.emit(`device:${deviceId}`, data);
  }
}