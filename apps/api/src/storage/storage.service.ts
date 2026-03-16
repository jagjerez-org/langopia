import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class StorageService {
  private s3Client: S3Client | null = null;
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint = this.config.get("S3_ENDPOINT", "http://localhost:9002");
    this.bucket = this.config.get("S3_BUCKET", "langopia-recordings");
    this.region = this.config.get("S3_REGION", "us-east-1");
    this.accessKey = this.config.get("S3_ACCESS_KEY", "minioadmin");
    this.secretKey = this.config.get("S3_SECRET_KEY", "minioadmin");
  }

  getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        endpoint: this.endpoint,
        region: this.region,
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
        },
        forcePathStyle: true,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      });
    }
    return this.s3Client;
  }

  getBucket(): string {
    return this.bucket;
  }

  getUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const client = this.getS3Client();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(client as any, command as any, { expiresIn });
  }

  async uploadToS3(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const client = this.getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return this.getUrl(key);
  }

  async getFromS3(key: string): Promise<Buffer> {
    const client = this.getS3Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    const stream = response.Body;
    if (!stream) throw new Error("Empty response from S3");
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async deleteFromS3(key: string): Promise<void> {
    const client = this.getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async deleteMultipleFromS3(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const client = this.getS3Client();
    await client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
        },
      }),
    );
  }
}
