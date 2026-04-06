import { extname } from 'path';

import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

import { FirebaseAdminService } from './firebase-admin.service';

import type { Storage } from 'firebase-admin/storage';

export interface UploadedFileInfo {
  fileName: string;
  downloadURL: string;
  gsURL: string;
  size: number;
  mimeType: string;
  bucket: string;
  uploadedAt: Date;
}

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  progressive?: boolean;
}

export interface UploadOptions {
  folder?: string;
  makePublic?: boolean;
  metadata?: Record<string, string>;
  imageProcessing?: ImageProcessingOptions;
}

@Injectable()
export class FirebaseStorageService {
  private readonly logger = new Logger(FirebaseStorageService.name);
  private storage!: Storage;
  private bucket!: ReturnType<Storage['bucket']>;
  private defaultBucketName!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly firebaseAdminService: FirebaseAdminService,
  ) {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    try {
      // Get the initialized Firebase Admin app through the service
      const app = this.firebaseAdminService.getApp();

      if (!app || !this.firebaseAdminService.isInitialized()) {
        this.logger.warn(
          'Firebase Admin SDK not yet initialized. Storage will be initialized lazily.',
        );
        return;
      }

      // Initialize Storage
      this.storage = getStorage(app);

      // Read bucket name from env (FIREBASE_STORAGE_BUCKET), fall back to projectId.appspot.com
      this.defaultBucketName = this.configService.get<string>(
        'FIREBASE_STORAGE_BUCKET',
        `${this.configService.get('FIREBASE_PROJECT_ID', 'toofreshtowaste')}.appspot.com`,
      );
      this.bucket = this.storage.bucket(this.defaultBucketName);

      this.logger.log(`✅ Firebase Storage initialized with bucket: ${this.defaultBucketName}`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * Ensure Firebase Storage is initialized (lazy initialization)
   */
  private ensureInitialized(): void {
    if (this.storage === undefined || this.bucket === undefined) {
      this.initializeStorage();

      if (this.storage === undefined || this.bucket === undefined) {
        throw new InternalServerErrorException(
          'Firebase Storage is not available. Check Firebase configuration.',
        );
      }
    }
  }

  /**
   * Upload a single file to Firebase Storage
   */
  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions = {},
  ): Promise<UploadedFileInfo> {
    try {
      this.ensureInitialized();
      this.validateFile(file);

      let processedBuffer: Buffer;
      let finalMimeType = file.mimetype;
      let finalExtension = extname(file.originalname);

      // Process image if options are provided and file is an image
      if (options.imageProcessing && this.isImageFile(file)) {
        const processed = await this.processImage(file.buffer, options.imageProcessing);
        processedBuffer = processed.buffer;
        finalMimeType = processed.mimeType;
        finalExtension = processed.extension;
      } else {
        processedBuffer = file.buffer;
      }

      // Generate unique filename
      const fileName = this.generateFileName(file.originalname, finalExtension, options.folder);

      // Upload to Firebase Storage
      const fileRef = this.bucket.file(fileName);

      await fileRef.save(processedBuffer, {
        metadata: {
          contentType: finalMimeType,
          metadata: {
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
            ...options.metadata,
          },
        },
        public: options.makePublic ?? true,
        validation: 'crc32c',
      });

      // Get download URL
      let downloadURL: string;
      if (options.makePublic !== false) {
        await fileRef.makePublic();
        downloadURL = `https://storage.googleapis.com/${this.defaultBucketName}/${fileName}`;
      } else {
        const [url] = await fileRef.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        downloadURL = url;
      }

      const uploadInfo: UploadedFileInfo = {
        fileName,
        downloadURL,
        gsURL: `gs://${this.defaultBucketName}/${fileName}`,
        size: processedBuffer.length,
        mimeType: finalMimeType,
        bucket: this.defaultBucketName,
        uploadedAt: new Date(),
      };

      this.logger.debug(`✅ File uploaded successfully: ${fileName}`);
      return uploadInfo;
    } catch (error) {
      this.logger.error('❌ Failed to upload file:', error);
      throw new InternalServerErrorException(
        `File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Upload multiple files to Firebase Storage
   */
  async uploadFiles(
    files: Express.Multer.File[],
    options: UploadOptions = {},
  ): Promise<UploadedFileInfo[]> {
    if (files.length === 0) {
      return [];
    }

    const uploadPromises = files.map(async (file) => {
      const result = await this.uploadFile(file, options);
      return result;
    });

    try {
      const results = await Promise.allSettled(uploadPromises);

      const successful: UploadedFileInfo[] = [];
      const failed: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          const errorMessage =
            result.reason instanceof Error ? result.reason.message : 'Unknown error';
          failed.push(`File ${index + 1}: ${errorMessage}`);
          this.logger.error(`Failed to upload file ${index + 1}:`, result.reason);
        }
      });

      if (failed.length > 0) {
        this.logger.warn(`Some files failed to upload: ${failed.join(', ')}`);
      }

      this.logger.log(`✅ Uploaded ${successful.length}/${files.length} files successfully`);
      return successful;
    } catch (error) {
      this.logger.error('❌ Batch file upload failed:', error);
      throw new InternalServerErrorException('Batch file upload failed');
    }
  }

  /**
   * Delete a file from Firebase Storage
   */
  async deleteFile(fileName: string): Promise<void> {
    try {
      this.ensureInitialized();
      const fileRef = this.bucket.file(fileName);
      await fileRef.delete();

      this.logger.debug(`✅ File deleted successfully: ${fileName}`);
    } catch (error) {
      if (error !== null && error !== undefined && typeof error === 'object' && 'code' in error) {
        const errorCode = (error as { code?: unknown }).code;
        if (errorCode === 404) {
          this.logger.warn(`File not found for deletion: ${fileName}`);
          return; // File doesn't exist, consider it deleted
        }
      }

      this.logger.error(`❌ Failed to delete file ${fileName}:`, error);
      throw new InternalServerErrorException(
        `File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete multiple files from Firebase Storage
   */
  async deleteFiles(fileNames: string[]): Promise<void> {
    if (fileNames.length === 0) {
      return;
    }

    const deletePromises = fileNames.map(async (fileName) => {
      await this.deleteFile(fileName);
    });

    try {
      await Promise.allSettled(deletePromises);
      this.logger.log(`✅ Processed deletion of ${fileNames.length} files`);
    } catch (error) {
      this.logger.error('❌ Batch file deletion failed:', error);
      throw new InternalServerErrorException('Batch file deletion failed');
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileName: string): Promise<Record<string, unknown>> {
    try {
      this.ensureInitialized();
      const fileRef = this.bucket.file(fileName);
      const [metadata] = await fileRef.getMetadata();
      return metadata;
    } catch (error) {
      this.logger.error(`❌ Failed to get metadata for ${fileName}:`, error);
      throw new InternalServerErrorException(
        `Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate signed URL for private files
   */
  async getSignedUrl(
    fileName: string,
    expiresIn: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<string> {
    try {
      this.ensureInitialized();
      const fileRef = this.bucket.file(fileName);
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn,
      });
      return url;
    } catch (error) {
      this.logger.error(`❌ Failed to generate signed URL for ${fileName}:`, error);
      throw new InternalServerErrorException(
        `Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if file exists in storage
   */
  async fileExists(fileName: string): Promise<boolean> {
    try {
      this.ensureInitialized();
      const fileRef = this.bucket.file(fileName);
      const [exists] = await fileRef.exists();
      return exists;
    } catch (error) {
      this.logger.error(`❌ Failed to check file existence for ${fileName}:`, error);
      return false;
    }
  }

  // Private helper methods

  private validateFile(file: Express.Multer.File | undefined): void {
    if (file === null || file === undefined) {
      throw new BadRequestException('No file provided');
    }

    if (file.buffer.length === 0) {
      throw new BadRequestException('File buffer is empty');
    }

    // Check file size (configurable via env, default 10MB)
    const maxSizeMB = parseInt(
      this.configService.get<string>('FIREBASE_MAX_FILE_SIZE_MB', '10'),
      10,
    );
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Validate mime type for security
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'text/csv',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }
  }

  private isImageFile(file: Express.Multer.File): boolean {
    return file.mimetype.startsWith('image/');
  }

  private async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions,
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    try {
      let sharpInstance = sharp(buffer);

      // Resize if dimensions are specified
      if (options.maxWidth || options.maxHeight) {
        sharpInstance = sharpInstance.resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Set format and quality
      const format = options.format ?? 'jpeg';
      const quality = options.quality ?? 85;

      let processedBuffer: Buffer;
      let mimeType: string;
      let extension: string;

      switch (format) {
        case 'jpeg':
          processedBuffer = await sharpInstance
            .jpeg({ quality, progressive: options.progressive ?? true })
            .toBuffer();
          mimeType = 'image/jpeg';
          extension = '.jpg';
          break;
        case 'png':
          processedBuffer = await sharpInstance
            .png({ quality, progressive: options.progressive ?? false })
            .toBuffer();
          mimeType = 'image/png';
          extension = '.png';
          break;
        case 'webp':
          processedBuffer = await sharpInstance.webp({ quality }).toBuffer();
          mimeType = 'image/webp';
          extension = '.webp';
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      return { buffer: processedBuffer, mimeType, extension };
    } catch (error) {
      this.logger.error('❌ Image processing failed:', error);
      throw new InternalServerErrorException(
        `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private generateFileName(originalName: string, extension: string, folder?: string): string {
    const timestamp = Date.now();
    const randomId = uuidv4().split('-')[0];
    const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');

    const fileName = `${baseName}_${timestamp}_${randomId}${extension}`;

    return folder ? `${folder}/${fileName}` : fileName;
  }
}
