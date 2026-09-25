import { extname } from 'path';

import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

import type { FileObject } from '@supabase/storage-js';

import { appError } from '../errors';
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
export class SupabaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private supabase!: SupabaseClient;
  private bucketName!: string;
  private supabaseUrl!: string;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.initializeSupabase();
  }

  private initializeSupabase(): void {
    try {
      this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') ?? '';
      const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
      this.bucketName =
        this.configService.get<string>('SUPABASE_STORAGE_BUCKET', 'uploads') || 'uploads';

      if (!this.supabaseUrl || !serviceRoleKey) {
        this.logger.warn(
          'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env',
        );
        return;
      }

      this.supabase = createClient(this.supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      this.initialized = true;
      this.logger.log(`Supabase Storage initialized with bucket: ${this.bucketName}`);
    } catch (error) {
      this.logger.error('Failed to initialize Supabase Storage:', error);
      throw error;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private ensureInitialized(): void {
    if (!this.initialized || this.supabase === undefined) {
      this.initializeSupabase();

      if (!this.initialized || this.supabase === undefined) {
        throw new InternalServerErrorException(appError('STORAGE_UNAVAILABLE'));
      }
    }
  }

  /**
   * Upload a single file to Supabase Storage
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

      if (options.imageProcessing && this.isImageFile(file)) {
        const processed = await this.processImage(file.buffer, options.imageProcessing);
        processedBuffer = processed.buffer;
        finalMimeType = processed.mimeType;
        finalExtension = processed.extension;
      } else {
        processedBuffer = file.buffer;
      }

      const fileName = this.generateFileName(file.originalname, finalExtension, options.folder);

      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(fileName, processedBuffer, {
          contentType: finalMimeType,
          upsert: false,
          duplex: 'half',
        });

      if (uploadError) {
        this.logger.error('Supabase upload error:', uploadError);
        throw new InternalServerErrorException(appError('FILE_UPLOAD_FAILED'));
      }

      // Build the public URL
      const downloadURL = this.getPublicUrl(fileName);

      const uploadInfo: UploadedFileInfo = {
        fileName,
        downloadURL,
        gsURL: `supabase://${this.bucketName}/${fileName}`,
        size: processedBuffer.length,
        mimeType: finalMimeType,
        bucket: this.bucketName,
        uploadedAt: new Date(),
      };

      this.logger.debug(`File uploaded successfully: ${fileName}`);
      return uploadInfo;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('Failed to upload file:', error);
      throw new InternalServerErrorException(appError('FILE_UPLOAD_FAILED'));
    }
  }

  /**
   * Upload multiple files to Supabase Storage
   */
  async uploadFiles(
    files: Express.Multer.File[],
    options: UploadOptions = {},
  ): Promise<UploadedFileInfo[]> {
    if (files.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      files.map(async file => {
        const uploaded = await this.uploadFile(file, options);
        return uploaded;
      }),
    );

    const successful: UploadedFileInfo[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push(`File ${index + 1}: ${this.getErrorMessage(result.reason)}`);
        this.logger.error(`Failed to upload file ${index + 1}:`, result.reason);
      }
    });

    if (failed.length > 0) {
      this.logger.warn(`Some files failed to upload: ${failed.join(', ')}`);
    }

    this.logger.log(`Uploaded ${successful.length}/${files.length} files successfully`);
    return successful;
  }

  /**
   * Delete a file from Supabase Storage.
   * Accepts either a relative path (e.g. "offers/img.jpg")
   * or a full public URL (e.g. "https://xyz.supabase.co/storage/v1/object/public/uploads/offers/img.jpg").
   */
  async deleteFile(fileNameOrUrl: string): Promise<void> {
    try {
      this.ensureInitialized();

      const filePath = this.extractFilePath(fileNameOrUrl);

      const { error } = await this.supabase.storage.from(this.bucketName).remove([filePath]);

      if (error) {
        this.logger.error(`Failed to delete file ${filePath}:`, error);
        throw new InternalServerErrorException(appError('FILE_DELETE_FAILED'));
      }

      this.logger.debug(`File deleted successfully: ${filePath}`);
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Failed to delete file ${fileNameOrUrl}:`, error);
      throw new InternalServerErrorException(appError('FILE_DELETE_FAILED'));
    }
  }

  /**
   * Delete multiple files from Supabase Storage.
   * Accepts either relative paths or full public URLs (mixed is fine).
   */
  async deleteFiles(fileNamesOrUrls: string[]): Promise<void> {
    if (fileNamesOrUrls.length === 0) {
      return;
    }

    try {
      this.ensureInitialized();

      const filePaths = fileNamesOrUrls.map(f => this.extractFilePath(f));

      const { error } = await this.supabase.storage.from(this.bucketName).remove(filePaths);

      if (error) {
        this.logger.error('Batch file deletion failed:', error);
        throw new InternalServerErrorException(appError('FILE_DELETE_FAILED'));
      }

      this.logger.log(`Processed deletion of ${filePaths.length} files`);
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('Batch file deletion failed:', error);
      throw new InternalServerErrorException(appError('FILE_DELETE_FAILED'));
    }
  }

  /**
   * Get file metadata (Supabase doesn't have direct metadata API, so we list the file)
   */
  async getFileMetadata(fileNameOrUrl: string): Promise<FileObject> {
    try {
      this.ensureInitialized();

      const filePath = this.extractFilePath(fileNameOrUrl);
      const folder = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
      const file = filePath.includes('/')
        ? filePath.substring(filePath.lastIndexOf('/') + 1)
        : filePath;

      const { data, error } = await this.supabase.storage.from(this.bucketName).list(folder, {
        search: file,
        limit: 1,
      });

      if (error) {
        throw new InternalServerErrorException(appError('FILE_URL_FAILED'));
      }

      if (data === null || data === undefined || data.length === 0) {
        throw new InternalServerErrorException(appError('FILE_NOT_FOUND'));
      }

      return data[0] as FileObject;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Failed to get metadata for ${fileNameOrUrl}:`, error);
      throw new InternalServerErrorException(appError('FILE_URL_FAILED'));
    }
  }

  /**
   * Generate signed URL for private files
   */
  async getSignedUrl(fileNameOrUrl: string, expiresIn: number = 7 * 24 * 60 * 60): Promise<string> {
    try {
      this.ensureInitialized();

      const filePath = this.extractFilePath(fileNameOrUrl);

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        throw new InternalServerErrorException(appError('FILE_URL_FAILED'));
      }

      return data.signedUrl;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Failed to generate signed URL for ${fileNameOrUrl}:`, error);
      throw new InternalServerErrorException(appError('FILE_URL_FAILED'));
    }
  }

  /**
   * Check if file exists in storage
   */
  async fileExists(fileNameOrUrl: string): Promise<boolean> {
    try {
      this.ensureInitialized();

      const filePath = this.extractFilePath(fileNameOrUrl);
      const folder = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
      const file = filePath.includes('/')
        ? filePath.substring(filePath.lastIndexOf('/') + 1)
        : filePath;

      const { data, error } = await this.supabase.storage.from(this.bucketName).list(folder, {
        search: file,
        limit: 1,
      });

      if (error) {
        return false;
      }

      return data !== null && data !== undefined && data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the public URL for a file
   */
  private getPublicUrl(fileName: string): string {
    const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(fileName);

    return data.publicUrl;
  }

  // Private helper methods

  /**
   * Extracts the relative file path from a full Supabase public URL or returns as-is if already a path.
   *
   * Full URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
   * This method strips everything up to and including the bucket name, returning just <path>.
   */
  private extractFilePath(fileNameOrUrl: string): string {
    if (!fileNameOrUrl) {
      return fileNameOrUrl;
    }

    // If it's a full Supabase URL, extract the path after /storage/v1/object/public/<bucket>/
    const publicPrefix = `/storage/v1/object/public/${this.bucketName}/`;
    const signedPrefix = `/storage/v1/object/sign/${this.bucketName}/`;

    for (const prefix of [publicPrefix, signedPrefix]) {
      const prefixIndex = fileNameOrUrl.indexOf(prefix);
      if (prefixIndex !== -1) {
        const extracted = fileNameOrUrl.substring(prefixIndex + prefix.length);
        // Remove any query parameters (e.g. ?token=xxx on signed URLs)
        return extracted.split('?')[0] ?? '';
      }
    }

    // Already a relative path — return as-is
    return fileNameOrUrl;
  }

  private validateFile(file: Express.Multer.File | undefined): void {
    if (file === null || file === undefined) {
      throw new BadRequestException(appError('FILE_REQUIRED'));
    }

    if (file.buffer.length === 0) {
      throw new BadRequestException(appError('FILE_EMPTY'));
    }

    const maxSizeMB = parseInt(
      this.configService.get<string>('SUPABASE_MAX_FILE_SIZE_MB', '10'),
      10,
    );
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(appError('FILE_TOO_LARGE', { maxMb: maxSizeMB }));
    }

    // Normalise image/jpg → image/jpeg (both refer to the same format)
    const declaredMime = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'text/csv',
    ];

    if (!allowedMimeTypes.includes(declaredMime)) {
      throw new BadRequestException(appError('FILE_TYPE_NOT_ALLOWED'));
    }

    // Text files: scan for null bytes — pure UTF-8/ASCII never contains them,
    // but every binary format (EXE, PHP, ZIP, PDF…) does.
    // Scanning the first 8 KB is sufficient; binaries have null bytes near the start.
    if (declaredMime === 'text/plain' || declaredMime === 'text/csv') {
      const scanLength = Math.min(file.buffer.length, 8192);
      for (let i = 0; i < scanLength; i++) {
        if (file.buffer[i] === 0x00) {
          throw new BadRequestException(appError('FILE_TYPE_MISMATCH'));
        }
      }
      return;
    }

    // Detect actual file type from buffer contents (magic bytes)
    const detected = this.detectMimeType(file.buffer);

    if (!detected) {
      throw new BadRequestException(appError('FILE_TYPE_UNKNOWN'));
    }

    if (detected.mime !== declaredMime) {
      throw new BadRequestException(appError('FILE_TYPE_MISMATCH'));
    }
  }

  // Inline magic-bytes detection for the MIME types accepted by this service.
  // Replaces the `file-type` npm package (v17+ is ESM-only, incompatible with CJS NestJS).
  private detectMimeType(buffer: Buffer): { mime: string; ext: string } | undefined {
    if (buffer.length < 4) {
      return undefined;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mime: 'image/png', ext: 'png' };
    }

    // GIF87a or GIF89a: 47 49 46 38 [37|39] 61
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      return { mime: 'image/gif', ext: 'gif' };
    }

    // WebP: RIFF????WEBP (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { mime: 'image/webp', ext: 'webp' };
    }

    // PDF: %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { mime: 'application/pdf', ext: 'pdf' };
    }

    return undefined;
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

      if (options.maxWidth || options.maxHeight) {
        sharpInstance = sharpInstance.resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

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
      this.logger.error('Image processing failed:', error);
      throw new InternalServerErrorException(appError('IMAGE_PROCESSING_FAILED'));
    }
  }

  /**
   * Returns a Supabase Image Transform URL for on-the-fly resizing.
   * Requires Image Transformations enabled on the Supabase project (Pro plan).
   * If the URL is not a Supabase storage URL, returns it unmodified.
   */
  static getTransformedUrl(
    url: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: string;
      resize?: string;
    },
  ): string {
    if (!url?.includes('/storage/v1/object/public/')) {
      return url;
    }

    const transformed = url.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/',
    );
    const params = new URLSearchParams();
    if (options.width) {
      params.set('width', String(options.width));
    }
    if (options.height) {
      params.set('height', String(options.height));
    }
    if (options.quality) {
      params.set('quality', String(options.quality));
    }
    if (options.format) {
      params.set('format', options.format);
    }
    if (options.resize) {
      params.set('resize', options.resize);
    }

    const qs = params.toString();
    return qs ? `${transformed}?${qs}` : transformed;
  }

  private generateFileName(originalName: string, extension: string, folder?: string): string {
    const timestamp = Date.now();
    const randomId = uuidv4().split('-')[0];
    const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');

    const fileName = `${baseName}_${timestamp}_${randomId}${extension}`;

    return folder ? `${folder}/${fileName}` : fileName;
  }
}
