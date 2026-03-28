import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Get service account configuration from environment
      const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
      const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');

      let serviceAccountObj: admin.ServiceAccount;

      if (serviceAccountPath) {
        // Option 1: Load from file path (recommended for production)
        serviceAccountObj = this.loadServiceAccountFromFile(serviceAccountPath);
      } else if (serviceAccountJson) {
        // Option 2: Load from JSON string (fallback for legacy config)
        serviceAccountObj = this.parseServiceAccountFromJson(serviceAccountJson);
      } else {
        this.logger.warn(
          'Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT',
        );
        return;
      }

      // Validate the service account object
      this.validateServiceAccount(serviceAccountObj);

      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        const storageBucket = this.configService.get<string>(
          'FIREBASE_STORAGE_BUCKET',
          `${serviceAccountObj.projectId}.appspot.com`,
        );

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountObj),
          ...(serviceAccountObj.projectId !== undefined
            ? { projectId: serviceAccountObj.projectId }
            : {}),
          storageBucket,
        });
      }

      this.initialized = true;
      this.logger.log('✅ Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.handleFirebaseInitError(error);
    }
  }

  /**
   * Get the initialized Firebase Admin app
   */
  getApp(): admin.app.App | null {
    return admin.apps[0] ?? null;
  }

  /**
   * Check if Firebase Admin is initialized
   */
  isInitialized(): boolean {
    return this.initialized && admin.apps.length > 0;
  }

  /**
   * Load service account from file path
   */
  private loadServiceAccountFromFile(serviceAccountPath: string): admin.ServiceAccount {
    try {
      // Resolve relative path from project root
      const absolutePath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath);

      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Firebase service account file not found: ${absolutePath}`);
      }

      // Read and parse the JSON file
      const fileContent = fs.readFileSync(absolutePath, 'utf8');
      const rawServiceAccount = JSON.parse(fileContent);

      // Convert raw JSON to Firebase ServiceAccount format
      const serviceAccountObj = this.convertRawServiceAccount(rawServiceAccount);

      this.logger.debug(`Loaded Firebase service account from: ${absolutePath}`);
      return serviceAccountObj;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in Firebase service account file: ${serviceAccountPath}`);
      }
      throw error;
    }
  }

  /**
   * Parse service account from JSON string (legacy support)
   */
  private parseServiceAccountFromJson(serviceAccountJson: string): admin.ServiceAccount {
    try {
      const rawServiceAccount = JSON.parse(serviceAccountJson);

      // Convert raw JSON to Firebase ServiceAccount format
      const serviceAccountObj = this.convertRawServiceAccount(rawServiceAccount);

      this.logger.debug('Parsed Firebase service account from environment variable');
      return serviceAccountObj;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON format in FIREBASE_SERVICE_ACCOUNT environment variable');
      }
      throw error;
    }
  }

  /**
   * Convert raw service account JSON to Firebase ServiceAccount interface
   */
  private convertRawServiceAccount(raw: Record<string, unknown>): admin.ServiceAccount {
    // Fix private key formatting by replacing \\n with actual newlines
    let privateKeyRaw = (raw['private_key'] ?? raw['privateKey']) as string | undefined;
    if (privateKeyRaw && typeof privateKeyRaw === 'string') {
      privateKeyRaw = privateKeyRaw.replace(/\\n/g, '\n');
    }

    // Convert to Firebase ServiceAccount interface
    // Only include properties that exist in Firebase's ServiceAccount interface
    const projectId = (raw['project_id'] ?? raw['projectId']) as string | undefined;
    const clientEmail = (raw['client_email'] ?? raw['clientEmail']) as string | undefined;
    const serviceAccount: admin.ServiceAccount = {
      ...(projectId !== undefined ? { projectId } : {}),
      ...(privateKeyRaw !== undefined ? { privateKey: privateKeyRaw } : {}),
      ...(clientEmail !== undefined ? { clientEmail } : {}),
    };

    return serviceAccount;
  }

  /**
   * Validate service account object has required fields
   */
  private validateServiceAccount(serviceAccountObj: admin.ServiceAccount): void {
    // Validate required fields for Firebase ServiceAccount interface
    const requiredFields = [
      { key: 'projectId', value: serviceAccountObj.projectId },
      { key: 'privateKey', value: serviceAccountObj.privateKey },
      { key: 'clientEmail', value: serviceAccountObj.clientEmail },
    ];

    for (const field of requiredFields) {
      if (!field.value || typeof field.value !== 'string' || field.value.trim() === '') {
        throw new Error(`Missing or invalid Firebase service account field: ${field.key}`);
      }
    }

    // Validate private key format
    const privateKey = serviceAccountObj.privateKey ?? '';
    if (!this.isValidPrivateKeyFormat(privateKey)) {
      throw new Error('Invalid private key format - must be a valid PEM formatted private key');
    }

    // Validate email format
    if (!this.isValidEmailFormat(serviceAccountObj.clientEmail ?? '')) {
      throw new Error('Invalid client email format');
    }
  }

  /**
   * Validate private key format
   */
  private isValidPrivateKeyFormat(privateKey: string): boolean {
    return (
      !!privateKey &&
      privateKey.includes('-----BEGIN PRIVATE KEY-----') &&
      privateKey.includes('-----END PRIVATE KEY-----') &&
      privateKey.length > 100
    ); // Basic length check
  }

  /**
   * Validate email format
   */
  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Handle Firebase initialization errors with detailed logging
   */
  private handleFirebaseInitError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`❌ Failed to initialize Firebase Admin SDK: ${errorMessage}`);

    // Log additional debugging info for common errors
    if (error instanceof SyntaxError) {
      this.logger.error('💡 Check JSON syntax in your Firebase service account configuration');
    } else if (errorMessage.includes('not found')) {
      this.logger.error('💡 Verify the FIREBASE_SERVICE_ACCOUNT_PATH points to the correct file');
    } else if (errorMessage.includes('Missing required')) {
      this.logger.error('💡 Ensure all required fields are present in your service account JSON');
    } else if (errorMessage.includes('private key')) {
      this.logger.error('💡 Check private key format and ensure proper line endings');
    }

    // Log stack trace in debug mode
    if (error instanceof Error && process.env['NODE_ENV'] === 'development') {
      this.logger.debug(error.stack);
    }
  }
}
