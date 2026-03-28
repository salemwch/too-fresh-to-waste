import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

export interface LocalUploadOptions {
  folder: string;
  imageProcessing?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  };
}

export interface LocalUploadResult {
  fileName: string;
  downloadURL: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadsDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Use uploads directory in the project root
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.baseUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');

    // Ensure uploads directory exists
    this.ensureUploadsDirExists();
  }

  /**
   * Ensure uploads directory and subdirectories exist
   */
  private ensureUploadsDirExists(): void {
    const dirs = [
      this.uploadsDir,
      path.join(this.uploadsDir, 'establishments'),
      path.join(this.uploadsDir, 'offers'),
      path.join(this.uploadsDir, 'profile-images'),
    ];

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Created directory: ${dir}`);
      }
    });
  }

  /**
   * Upload a single file to local storage
   */
  async uploadFile(
    file: Express.Multer.File,
    options: LocalUploadOptions,
  ): Promise<LocalUploadResult> {
    try {
      const { folder, imageProcessing } = options;

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(4).toString('hex');
      const ext = imageProcessing?.format || 'jpg';
      const fileName = `${path.parse(file.originalname).name}_${timestamp}_${randomString}.${ext}`;

      // Ensure folder exists
      const folderPath = path.join(this.uploadsDir, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const filePath = path.join(folderPath, fileName);

      // Process image if options are provided
      let buffer = file.buffer;
      let mimeType = file.mimetype;

      if (imageProcessing && file.mimetype.startsWith('image/')) {
        const { maxWidth, maxHeight, quality, format } = imageProcessing;

        let sharpInstance = sharp(file.buffer);

        // Resize if dimensions specified
        if (maxWidth || maxHeight) {
          sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }

        // Convert format
        if (format === 'jpeg') {
          sharpInstance = sharpInstance.jpeg({ quality: quality || 80 });
          mimeType = 'image/jpeg';
        } else if (format === 'png') {
          sharpInstance = sharpInstance.png({ quality: quality || 80 });
          mimeType = 'image/png';
        } else if (format === 'webp') {
          sharpInstance = sharpInstance.webp({ quality: quality || 80 });
          mimeType = 'image/webp';
        }

        buffer = await sharpInstance.toBuffer();
      }

      // Write file to disk
      fs.writeFileSync(filePath, buffer);

      const fileSize = buffer.length;
      const downloadURL = `${this.baseUrl}/uploads/${folder}/${fileName}`;

      this.logger.log(`✅ File uploaded successfully: ${downloadURL}`);

      return {
        fileName,
        downloadURL,
        size: fileSize,
        mimeType,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to upload file: ${file.originalname}`, error);
      throw new InternalServerErrorException(
        `File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Upload multiple files to local storage
   */
  async uploadFiles(
    files: Express.Multer.File[],
    options: LocalUploadOptions,
  ): Promise<LocalUploadResult[]> {
    this.logger.log(`📤 Uploading ${files.length} file(s) to local storage...`);

    const uploadPromises = files.map(async (file) => {
      const result = await this.uploadFile(file, options);
      return result;
    });
    const results = await Promise.allSettled(uploadPromises);

    const successfulUploads: LocalUploadResult[] = [];
    const failedUploads: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulUploads.push(result.value);
      } else {
        failedUploads.push(`File ${index + 1}: ${result.reason.message}`);
      }
    });

    if (failedUploads.length > 0) {
      this.logger.warn(`⚠️ Some files failed to upload: ${failedUploads.join(', ')}`);
    }

    this.logger.log(`✅ Uploaded ${successfulUploads.length}/${files.length} files successfully`);

    return successfulUploads;
  }

  /**
   * Delete a file from local storage
   */
  deleteFile(fileUrl: string): void {
    try {
      // Extract relative path from URL
      const urlObj = new URL(fileUrl);
      const relativePath = urlObj.pathname.replace('/uploads/', '');
      const filePath = path.join(this.uploadsDir, relativePath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`File deleted: ${filePath}`);
      } else {
        this.logger.warn(`File not found: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${fileUrl}`, error);
      throw new InternalServerErrorException(
        `File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete multiple files from local storage
   */
  deleteFiles(fileUrls: string[]): void {
    for (const url of fileUrls) {
      this.deleteFile(url);
    }
  }
}
