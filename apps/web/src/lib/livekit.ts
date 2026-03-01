import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_HOST = process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace("ws", "http") ?? "http://localhost:7880";

let roomService: RoomServiceClient | null = null;

export function getRoomService(): RoomServiceClient {
  if (!roomService) {
    roomService = new RoomServiceClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }
  return roomService;
}

export async function createParticipantToken(
  roomName: string,
  identity: string,
  name: string,
  options: { canPublish?: boolean; canSubscribe?: boolean; canPublishData?: boolean } = {}
): Promise<string> {
  const { canPublish = true, canSubscribe = true, canPublishData = true } = options;

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
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
