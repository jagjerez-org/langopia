import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

@Injectable()
export class LiveKitService {
  private roomService: RoomServiceClient | null = null;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly host: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>("LIVEKIT_API_KEY");
    this.apiSecret = this.config.getOrThrow<string>("LIVEKIT_API_SECRET");
    const wsUrl =
      this.config.get<string>("LIVEKIT_URL") ??
      this.config.get<string>("NEXT_PUBLIC_LIVEKIT_URL") ??
      "ws://localhost:7880";
    this.host = wsUrl.replace("ws", "http");
  }

  getRoomService(): RoomServiceClient {
    if (!this.roomService) {
      this.roomService = new RoomServiceClient(
        this.host,
        this.apiKey,
        this.apiSecret,
      );
    }
    return this.roomService;
  }

  async createParticipantToken(
    roomName: string,
    identity: string,
    name: string,
    options: {
      canPublish?: boolean;
      canSubscribe?: boolean;
      canPublishData?: boolean;
    } = {},
  ): Promise<string> {
    const {
      canPublish = true,
      canSubscribe = true,
      canPublishData = true,
    } = options;

    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name,
      ttl: "6h",
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe,
      canPublishData,
    });

    return await token.toJwt();
  }
}
