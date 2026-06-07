import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>(
      'aws.secretAccessKey',
    );
    const region = this.configService.get<string>('aws.region') || 'us-east-1';
    const endpoint = this.configService.get<string>('aws.endpoint');
    this.bucketName = this.configService.get<string>('aws.bucket');

    if (accessKeyId && secretAccessKey && this.bucketName) {
      this.s3Client = new S3Client({
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        region,
        endpoint: endpoint || undefined,
        forcePathStyle: !!endpoint,
      });
      this.logger.log(
        '✅ AWS S3 / Cloudflare R2 Storage Client initialized successfully.',
      );
    } else {
      this.logger.warn(
        '⚠️ AWS S3 / R2 configuration is incomplete. StorageService operations will fail.',
      );
    }
  }

  // Helper check
  private checkClient() {
    if (!this.s3Client || !this.bucketName) {
      throw new BadRequestException({
        message: 'Storage service is not configured on this server.',
        code: 'STORAGE_UNCONFIGURED',
      });
    }
  }

  /**
   * Uploads a file buffer to S3/R2 bucket
   * @param file Express.Multer.File
   * @param folder Folder path inside bucket (default: 'uploads')
   * @returns Promise<{ url: string; key: string }>
   */
  async uploadFile(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<{ url: string; key: string }> {
    this.checkClient();

    const uniqueId = uuidv4();
    const ext = extname(file.originalname);
    const key = `${folder}/${uniqueId}${ext}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client!.send(command);

      // Construct public URL
      const region =
        this.configService.get<string>('aws.region') || 'us-east-1';
      const endpoint = this.configService.get<string>('aws.endpoint');

      let url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
      if (endpoint) {
        // Handle custom endpoint (R2, MinIO, etc.)
        url = `${endpoint}/${this.bucketName}/${key}`;
      }

      this.logger.log(`📁 File uploaded successfully: ${key}`);

      return { url, key };
    } catch (err: any) {
      this.logger.error(`❌ S3 Upload failed for key ${key}: ${err.message}`);
      throw new BadRequestException({
        message: 'File upload failed',
        code: 'UPLOAD_FAILED',
      });
    }
  }

  /**
   * Deletes a file from S3/R2 bucket by key
   * @param key String
   */
  async deleteFile(key: string): Promise<void> {
    this.checkClient();

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client!.send(command);
      this.logger.log(`🗑️ File deleted successfully: ${key}`);
    } catch (err: any) {
      this.logger.error(`❌ S3 Delete failed for key ${key}: ${err.message}`);
      throw new BadRequestException({
        message: 'File deletion failed',
        code: 'DELETE_FAILED',
      });
    }
  }

  /**
   * Generates a secure, temporary GET presigned URL for private attachments
   * @param key S3 key
   * @param expiresInSeconds default 3600 (1 hour)
   */
  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    this.checkClient();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client!, command, {
        expiresIn: expiresInSeconds,
      });
      return url;
    } catch (err: any) {
      this.logger.error(
        `❌ Presigned URL generation failed for key ${key}: ${err.message}`,
      );
      throw new BadRequestException({
        message: 'Could not generate download URL',
        code: 'PRESIGNED_URL_FAILED',
      });
    }
  }
}
