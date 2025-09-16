import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class PushService {
  constructor() {
    // Initialize Firebase Admin SDK with your service account key
    admin.initializeApp({
      credential: admin.credential.cert(require('path/to/serviceAccountKey.json')),
    });
  }

  async send(token: string, title: string, body: string) {
    const message = {
      notification: { title, body },
      token,
    };
    return admin.messaging().send(message);
  }
}