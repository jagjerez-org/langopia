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
      !!this.config.get<string>("TTS_SERVER_URL") ||
      // Legacy env vars (deprecated — use TTS_SERVER_URL instead)
      !!this.config.get<string>("RUNPOD_TTS_ENDPOINT_ID") ||
      !!this.config.get<string>("LOCAL_TTS_URL")
    );
  }

  /**
   * Resolve the TTS server URL. Priority:
   * 1. TTS_SERVER_URL (unified — works for both local and RunPod)
   * 2. RUNPOD_API_KEY + RUNPOD_TTS_ENDPOINT_ID (legacy RunPod)
   * 3. LOCAL_TTS_URL (legacy local)
   */
  private resolveTTSServerConfig(): {
    url: string;
    apiKey?: string;
    isRunPod: boolean;
  } | null {
    const ttsServerUrl = this.config.get<string>("TTS_SERVER_URL");
    if (ttsServerUrl) {
      // Detect RunPod URLs: https://api.runpod.ai/v2/<endpoint_id>
      const isRunPod = ttsServerUrl.includes("api.runpod.ai");
      const apiKey =
        this.config.get<string>("TTS_SERVER_API_KEY") ||
        this.config.get<string>("RUNPOD_API_KEY");
      return { url: ttsServerUrl.replace(/\/+$/, ""), apiKey, isRunPod };
    }

    // Legacy: RUNPOD_API_KEY + RUNPOD_TTS_ENDPOINT_ID
    const runpodKey = this.config.get<string>("RUNPOD_API_KEY");
    const endpointId = this.config.get<string>("RUNPOD_TTS_ENDPOINT_ID");
    if (runpodKey && endpointId) {
      return {
        url: `https://api.runpod.ai/v2/${endpointId}`,
        apiKey: runpodKey,
        isRunPod: true,
      };
    }

    // Legacy: LOCAL_TTS_URL
    const localUrl = this.config.get<string>("LOCAL_TTS_URL");
    if (localUrl) {
      return { url: localUrl.replace(/\/+$/, ""), isRunPod: false };
    }

    return null;
  }

  private getAvailableProviders(): TTSProvider[] {
    const providers: TTSProvider[] = [];

    // ElevenLabs (highest priority)
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

    // TTS Server (RunPod or local — unified via TTS_SERVER_URL)
    const serverConfig = this.resolveTTSServerConfig();
    if (serverConfig) {
      const { url, apiKey, isRunPod } = serverConfig;

      if (isRunPod) {
        providers.push({
          name: "RunPod-XTTS",
          synthesize: async (
            text: string,
            language: string,
          ): Promise<Buffer> => {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

            // Submit async job
            const runRes = await fetch(`${url}/run`, {
              method: "POST",
              headers,
              body: JSON.stringify({ input: { text, language } }),
            });
            if (!runRes.ok) {
              throw new Error(
                `RunPod /run returned ${runRes.status}: ${runRes.statusText}`,
              );
            }
            const { id: jobId } = (await runRes.json()) as { id: string };

            // Poll for completion
            const timeout = 120_000;
            const interval = 2_000;
            const start = Date.now();
            while (Date.now() - start < timeout) {
              await new Promise((r) => setTimeout(r, interval));
              const statusRes = await fetch(`${url}/status/${jobId}`, {
                headers: apiKey
                  ? { Authorization: `Bearer ${apiKey}` }
                  : undefined,
              });
              if (!statusRes.ok) {
                throw new Error(
                  `RunPod /status returned ${statusRes.status}: ${statusRes.statusText}`,
                );
              }
              const job = (await statusRes.json()) as {
                status: string;
                output?: { audio_base64?: string; error?: string };
              };
              if (job.status === "COMPLETED") {
                if (!job.output?.audio_base64) {
                  throw new Error(
                    `RunPod job completed without audio: ${JSON.stringify(job.output)}`,
                  );
                }
                return Buffer.from(job.output.audio_base64, "base64");
              }
              if (job.status === "FAILED") {
                throw new Error(
                  `RunPod job failed: ${job.output?.error ?? "unknown error"}`,
                );
              }
            }
            throw new Error(
              `RunPod job ${jobId} timed out after ${timeout}ms`,
            );
          },
        });
      } else {
        // Local/direct TTS server (synchronous POST)
        providers.push({
          name: "TTS-Server",
          synthesize: async (
            text: string,
            language: string,
          ): Promise<Buffer> => {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

            const response = await fetch(url, {
              method: "POST",
              headers,
              body: JSON.stringify({ text, language }),
            });
            if (!response.ok) {
              throw new Error(
                `TTS server returned ${response.status}: ${response.statusText}`,
              );
            }
            const json = (await response.json()) as { audio_base64: string };
            return Buffer.from(json.audio_base64, "base64");
          },
        });
      }
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
