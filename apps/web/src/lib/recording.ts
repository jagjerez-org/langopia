import { EgressClient, EncodedFileOutput, EncodedFileType } from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_HOST =
  process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace("ws", "http") ??
  "http://localhost:7880";

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "minioadmin";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? "minioadmin";
const S3_BUCKET = process.env.S3_BUCKET ?? "langopia-recordings";
const S3_REGION = process.env.S3_REGION ?? "us-east-1";

let egressClient: EgressClient | null = null;

function getEgressClient(): EgressClient {
  if (!egressClient) {
    egressClient = new EgressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }
  return egressClient;
}

export async function startRoomRecording(
  livekitRoomId: string,
  roomId: string
): Promise<string> {
  const client = getEgressClient();

  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: `recordings/${roomId}/{time}.mp4`,
    output: {
      case: "s3",
      value: {
        accessKey: S3_ACCESS_KEY,
        secret: S3_SECRET_KEY,
        bucket: S3_BUCKET,
        region: S3_REGION,
        endpoint: S3_ENDPOINT,
        forcePathStyle: true,
      },
    },
  });

  const info = await client.startRoomCompositeEgress(livekitRoomId, {
    file: output,
  });

  return info.egressId;
}

export async function stopRecording(egressId: string): Promise<string | null> {
  const client = getEgressClient();

  try {
    const info = await client.stopEgress(egressId);

    // Extract the file URL from the egress result
    const fileResult = info.fileResults?.[0];
    if (fileResult) {
      return `${S3_ENDPOINT}/${S3_BUCKET}/${fileResult.filename}`;
    }
    return null;
  } catch (err) {
    console.error("Failed to stop egress:", err);
    return null;
  }
}
