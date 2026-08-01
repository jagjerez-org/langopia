import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as schema from "@langopia/db/schema";
import { TENANT_CONTEXT, type TenantContext } from "../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  PublishedUnitVideoInput,
  VideoGeneratorPort,
} from "../../domain/ports/video-generator.port.js";
import { ContentAssetStorageAdapter } from "./storage.adapter.js";

const VIDEO_MIME_TYPE = "video/mp4";

export class MissingVideoProviderCredentialsError extends Error {
  constructor() {
    super("Faltan VIDEO_PROVIDER_API_KEY o VIDEO_PROVIDER_ENDPOINT: no se puede generar vídeo beta en este entorno.");
    this.name = "MissingVideoProviderCredentialsError";
  }
}

@Injectable()
export class VideoAdapter implements VideoGeneratorPort {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: ContentAssetStorageAdapter,
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async generateBetaVideoForPublishedUnit(unit: PublishedUnitVideoInput): Promise<void> {
    const enabled = await this.isVideoBetaEnabled();
    if (!enabled) return;

    const credentials = this.requireCredentials();
    const generated = await this.generateVideoBytes(unit, credentials);
    const schoolId = this.tenant.schoolId();
    const stored = await this.storage.store({
      schoolKey: schoolId,
      unitCode: unit.code,
      kind: "video",
      sequence: 1,
      body: generated.bytes,
      contentType: generated.mimeType,
    });

    await this.uow.execute(async () => {
      await this.drizzle.db.insert(schema.contentAssets).values({
        schoolId,
        contentUnitId: unit.contentUnitId,
        kind: "video",
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        bytes: stored.bytes,
        durationMs: generated.durationMs,
        provider: "video-beta",
        isBeta: true,
        altText: { [unit.primaryLocale]: `Vídeo beta de la unidad ${unit.code}: ${unit.topic}.` },
      });
    });
  }

  private async isVideoBetaEnabled(): Promise<boolean> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db
        .select({ videoBetaEnabled: schema.schools.videoBetaEnabled })
        .from(schema.schools)
        .limit(1);
      return rows[0]?.videoBetaEnabled ?? false;
    });
  }

  private requireCredentials(): { endpoint: string; apiKey: string } {
    const endpoint = this.config.get<string>("VIDEO_PROVIDER_ENDPOINT");
    const apiKey = this.config.get<string>("VIDEO_PROVIDER_API_KEY");
    if (!endpoint || !apiKey) throw new MissingVideoProviderCredentialsError();
    return { endpoint, apiKey };
  }

  protected async generateVideoBytes(
    unit: PublishedUnitVideoInput,
    credentials: { endpoint: string; apiKey: string },
  ): Promise<{ bytes: Buffer; mimeType: string; durationMs: number | null }> {
    const response = await fetch(credentials.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credentials.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        topic: unit.topic,
        language: unit.language,
        level: unit.level,
        locale: unit.primaryLocale,
      }),
    });
    if (!response.ok) throw new Error(`El proveedor de vídeo beta respondió ${response.status}.`);

    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type") ?? VIDEO_MIME_TYPE,
      durationMs: null,
    };
  }
}
