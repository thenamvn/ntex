import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as serviceAccount from '../../token/serviceAccountKey.json';

@Injectable()
export class PushService {
  constructor() {
    // Initialize Firebase Admin SDK with your service account key
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
    }
  }

  async send(token: string, title: string, body: string) {
    const message = {
      notification: { title, body },
      token,
    };
    return admin.messaging().send(message);
  }
}