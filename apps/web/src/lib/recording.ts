import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
} from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_HOST =
  process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace("ws", "http") ??
  "http://localhost:7880";

let egressClient: EgressClient | null = null;

function getEgressClient(): EgressClient {
  if (!egressClient) {
    egressClient = new EgressClient(
      LIVEKIT_HOST,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );
  }
  return egressClient;
}

export function isRecordingEnabled(): boolean {
  return process.env.LIVEKIT_EGRESS_ENABLED === "true";
}

export async function startRecording(
  roomName: string
): Promise<string | null> {
  if (!isRecordingEnabled()) {
    return null;
  }

  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: `recordings/${roomName}`,
  });

  const info = await getEgressClient().startRoomCompositeEgress(
    roomName,
    output
  );

  return info.egressId;
}

export async function stopRecording(
  egressId: string,
  roomName: string
): Promise<string | null> {
  if (!isRecordingEnabled()) {
    return null;
  }

  await getEgressClient().stopEgress(egressId);

  const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
  const bucket = process.env.S3_BUCKET ?? "langopia-recordings";
  return `${endpoint}/${bucket}/recordings/${roomName}.mp4`;
}
