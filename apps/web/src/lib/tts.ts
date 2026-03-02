import { ElevenLabsClient } from "elevenlabs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9002";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "minioadmin";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? "minioadmin";
const S3_BUCKET = process.env.S3_BUCKET ?? "langopia-recordings";
const S3_REGION = process.env.S3_REGION ?? "us-east-1";

let elevenLabsClient: ElevenLabsClient | null = null;
let s3Client: S3Client | null = null;

function getElevenLabs(): ElevenLabsClient {
  if (!elevenLabsClient) {
    elevenLabsClient = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }
  return elevenLabsClient;
}

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

export async function generateExerciseAudio(
  text: string,
  exerciseId: string,
  lang?: string
): Promise<string> {
  const client = getElevenLabs();

  // Use a multilingual voice model for language flexibility
  const audio = await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
    text,
    model_id: lang && lang !== "en" ? "eleven_multilingual_v2" : "eleven_multilingual_v2",
    output_format: "mp3_44100_128",
  });

  // Collect the stream into a buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // Upload to MinIO
  const key = `tts/${exerciseId}.mp3`;
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "audio/mpeg",
    })
  );

  return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
}
