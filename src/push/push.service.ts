import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class PushService {
  constructor() {
    // Initialize Firebase Admin SDK nếu chưa có
    if (!admin.apps.length) {
      try {
        // Cần có file serviceAccountKey.json trong thư mục token/
        const serviceAccount = require('../../token/serviceAccountKey.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase Admin SDK initialized');
      } catch (error) {
        console.warn('⚠️ Firebase Admin SDK not initialized:', error.message);
      }
    }
  }

  async send(token: string, title: string, body: string, data?: Record<string, string>) {
    try {
      const message: admin.messaging.Message = {
        notification: { 
          title, 
          body
        },
        data: data || {},
        token,
        android: {
          notification: {
            channelId: 'health_alerts',
            priority: 'high' as const,
            sound: 'default',
            defaultSound: true,
          }
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: 'default',
              badge: 1,
            }
          }
        }
      };
      
      const result = await admin.messaging().send(message);
      console.log('✅ FCM message sent successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ FCM send error:', error);
      throw error;
    }
  }

  // Method để gửi cho nhiều token cùng lúc
  async sendToMultiple(tokens: string[], title: string, body: string, data?: Record<string, string>) {
    try {
      const message: admin.messaging.MulticastMessage = {
        notification: { title, body },
        data: data || {},
        tokens,
      };
      
      const result = await admin.messaging().sendEachForMulticast(message);
      console.log('✅ FCM multicast sent:', result);
      return result;
    } catch (error) {
      console.error('❌ FCM multicast error:', error);
      throw error;
    }
  }

  // Test method để kiểm tra kết nối
  async testConnection(): Promise<boolean> {
    try {
      // Test với token giả để kiểm tra Firebase connection
      await admin.messaging().send({
        notification: { title: 'Test', body: 'Test' },
        token: 'test-token',
      });
      return true;
    } catch (error) {
      // Nếu lỗi là "registration-token-not-registered" thì Firebase hoạt động bình thường
      if (error.code === 'messaging/registration-token-not-registered') {
        return true;
      }
      console.error('❌ Firebase connection test failed:', error);
      return false;
    }
  }
}