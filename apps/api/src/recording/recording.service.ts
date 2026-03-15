import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
} from "livekit-server-sdk";

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);
  private egressClient: EgressClient | null = null;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly host: string;
  private readonly s3Endpoint: string;
  private readonly s3AccessKey: string;
  private readonly s3SecretKey: string;
  private readonly s3Bucket: string;
  private readonly s3Region: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>("LIVEKIT_API_KEY");
    this.apiSecret = this.config.getOrThrow<string>("LIVEKIT_API_SECRET");
    const wsUrl =
      this.config.get<string>("LIVEKIT_URL") ??
      this.config.get<string>("NEXT_PUBLIC_LIVEKIT_URL") ??
      "ws://localhost:7880";
    this.host = wsUrl.replace("ws", "http");
    this.s3Endpoint = this.config.get("S3_ENDPOINT", "http://localhost:9002");
    this.s3AccessKey = this.config.get("S3_ACCESS_KEY", "minioadmin");
    this.s3SecretKey = this.config.get("S3_SECRET_KEY", "minioadmin");
    this.s3Bucket = this.config.get("S3_BUCKET", "langopia-recordings");
    this.s3Region = this.config.get("S3_REGION", "us-east-1");
  }

  private getEgressClient(): EgressClient {
    if (!this.egressClient) {
      this.egressClient = new EgressClient(
        this.host,
        this.apiKey,
        this.apiSecret,
      );
    }
    return this.egressClient;
  }

  async startRoomRecording(
    livekitRoomId: string,
    roomId: string,
  ): Promise<string> {
    const client = this.getEgressClient();

    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `recordings/${roomId}/{time}.mp4`,
      output: {
        case: "s3",
        value: {
          accessKey: this.s3AccessKey,
          secret: this.s3SecretKey,
          bucket: this.s3Bucket,
          region: this.s3Region,
          endpoint: this.s3Endpoint,
          forcePathStyle: true,
        },
      },
    });

    const info = await client.startRoomCompositeEgress(livekitRoomId, {
      file: output,
    });

    return info.egressId;
  }

  async stopRecording(egressId: string): Promise<string | null> {
    const client = this.getEgressClient();

    try {
      const info = await client.stopEgress(egressId);
      const fileResult = info.fileResults?.[0];
      if (fileResult) {
        return `${this.s3Endpoint}/${this.s3Bucket}/${fileResult.filename}`;
      }
      return null;
    } catch (err) {
      this.logger.error("Failed to stop egress:", err);
      return null;
    }
  }
}
