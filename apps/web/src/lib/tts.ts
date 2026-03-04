import { ElevenLabsClient } from "elevenlabs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ── S3 config ──

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9002";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "minioadmin";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? "minioadmin";
const S3_BUCKET = process.env.S3_BUCKET ?? "langopia-recordings";
const S3_REGION = process.env.S3_REGION ?? "us-east-1";

let s3Client: S3Client | null = null;

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

// ── TTS Provider interface ──

interface TTSProvider {
  readonly name: string;
  synthesize(text: string, language: string): Promise<Buffer>;
}

// ── ElevenLabs provider ──

let elevenLabsClient: ElevenLabsClient | null = null;

function getElevenLabs(): ElevenLabsClient {
  if (!elevenLabsClient) {
    elevenLabsClient = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }
  return elevenLabsClient;
}

const elevenLabsProvider: TTSProvider = {
  name: "ElevenLabs",
  async synthesize(text: string): Promise<Buffer> {
    const client = getElevenLabs();
    const audio = await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
      text,
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
    });

    const chunks: Uint8Array[] = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  },
};

// ── Local TTS provider ──

const localTTSProvider: TTSProvider = {
  name: "LocalTTS",
  async synthesize(text: string, language: string): Promise<Buffer> {
    const url = process.env.LOCAL_TTS_URL ?? "http://192.168.0.17:8020/tts";
    const formData = new FormData();
    formData.append("text", text);
    formData.append("language", language);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Local TTS returned ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },
};

// ── Provider chain ──

function getAvailableProviders(): TTSProvider[] {
  const providers: TTSProvider[] = [];
  if (process.env.ELEVENLABS_API_KEY) providers.push(elevenLabsProvider);
  if (process.env.LOCAL_TTS_URL) providers.push(localTTSProvider);
  return providers;
}

export function isTTSAvailable(): boolean {
  return !!process.env.ELEVENLABS_API_KEY || !!process.env.LOCAL_TTS_URL;
}

// ── Public API (unchanged signature) ──

export async function generateExerciseAudio(
  text: string,
  exerciseId: string,
  lang?: string
): Promise<string> {
  const providers = getAvailableProviders();
  const language = lang || "en";

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const buffer = await provider.synthesize(text, language);

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
    } catch (err) {
      console.warn(`TTS provider "${provider.name}" failed:`, err);
      lastError = err;
    }
  }

  throw lastError ?? new Error("No TTS providers available");
}
