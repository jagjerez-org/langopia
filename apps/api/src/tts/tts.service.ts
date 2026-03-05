import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "../storage/storage.service.js";

interface TTSProvider {
  readonly name: string;
  synthesize(text: string, language: string): Promise<Buffer>;
}

@Injectable()
export class TTSService {
  private readonly logger = new Logger(TTSService.name);
  private elevenLabsClient: import("elevenlabs").ElevenLabsClient | null =
    null;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  private async getElevenLabs(): Promise<
    import("elevenlabs").ElevenLabsClient
  > {
    if (!this.elevenLabsClient) {
      const { ElevenLabsClient } = await import("elevenlabs");
      this.elevenLabsClient = new ElevenLabsClient({
        apiKey: this.config.get<string>("ELEVENLABS_API_KEY"),
      });
    }
    return this.elevenLabsClient;
  }

  isTTSAvailable(): boolean {
    return (
      !!this.config.get<string>("ELEVENLABS_API_KEY") ||
      !!this.config.get<string>("LOCAL_TTS_URL")
    );
  }

  private getAvailableProviders(): TTSProvider[] {
    const providers: TTSProvider[] = [];

    if (this.config.get<string>("ELEVENLABS_API_KEY")) {
      providers.push({
        name: "ElevenLabs",
        synthesize: async (text: string): Promise<Buffer> => {
          const client = await this.getElevenLabs();
          const audio = await client.textToSpeech.convert(
            "JBFqnCBsd6RMkjVDRZzb",
            {
              text,
              model_id: "eleven_multilingual_v2",
              output_format: "mp3_44100_128",
            },
          );
          const chunks: Uint8Array[] = [];
          for await (const chunk of audio) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks);
        },
      });
    }

    if (this.config.get<string>("LOCAL_TTS_URL")) {
      const url =
        this.config.get<string>("LOCAL_TTS_URL") ??
        "http://192.168.0.17:8020/tts";
      providers.push({
        name: "LocalTTS",
        synthesize: async (
          text: string,
          language: string,
        ): Promise<Buffer> => {
          const formData = new FormData();
          formData.append("text", text);
          formData.append("language", language);
          const response = await fetch(url, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            throw new Error(
              `Local TTS returned ${response.status}: ${response.statusText}`,
            );
          }
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        },
      });
    }

    return providers;
  }

  async generateExerciseAudio(
    text: string,
    exerciseId: string,
    lang?: string,
  ): Promise<string> {
    const providers = this.getAvailableProviders();
    const language = lang || "en";

    let lastError: unknown;
    for (const provider of providers) {
      try {
        const buffer = await provider.synthesize(text, language);
        const key = `tts/${exerciseId}.mp3`;
        return await this.storage.uploadToS3(key, buffer, "audio/mpeg");
      } catch (err) {
        this.logger.warn(`TTS provider "${provider.name}" failed:`, err);
        lastError = err;
      }
    }

    throw lastError ?? new Error("No TTS providers available");
  }
}
