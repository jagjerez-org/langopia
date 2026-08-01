import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import { OBJECT_STORAGE, type ObjectStoragePort } from "../../../../shared/domain/ports/object-storage.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { MaterialId } from "../../../domain/model/identifiers.js";
import { UploadedMaterial } from "../../../domain/model/uploaded-material.vo.js";
import {
  EMBEDDING_PROVIDER_PORT,
  type EmbeddingProviderPort,
} from "../../../domain/ports/embedding-provider.port.js";
import {
  MATERIAL_REPOSITORY,
  type MaterialRepository,
} from "../../../domain/ports/material.repository.port.js";
import { splitIntoFragments } from "../../../infrastructure/external/tts.adapter.js";
import { TextExtractionAdapter } from "../../../infrastructure/external/text-extraction.adapter.js";
import { UploadMaterialCommand } from "./upload-material.command.js";

/**
 * Tamaño de fragmento para indexar con `pgvector`. Distinto del límite de
 * `TtsAdapter` (`MAX_TTS_FRAGMENT_CHARACTERS`, pensado para lo que admite una
 * petición de síntesis de voz): aquí el límite es semántico —un fragmento
 * más pequeño localiza mejor el pasaje relevante al generar ejercicios—, no
 * el límite de ningún proveedor. Se reutiliza `splitIntoFragments` (corta en
 * límite de frase, nunca a mitad de palabra) porque el criterio de dónde
 * cortar es el mismo en los dos sitios.
 */
export const MAX_MATERIAL_CHUNK_CHARACTERS = 2000;

/** Clave de almacenamiento de un material: `{escuela}/materials/{id}/{parte}.{extensión}`. */
export function buildMaterialStorageKey(params: {
  schoolId: string;
  materialId: string;
  part: "original" | "processed";
  extension: string;
}): string {
  return `${params.schoolId}/materials/${params.materialId}/${params.part}.${params.extension}`;
}

const PROCESSED_MIME_TYPE = "text/plain; charset=utf-8";

/**
 * Sube y, si procede, indexa un material propio.
 *
 * El orden importa, y es el del brief:
 *
 *   1. Validar tipo y tamaño por CONTENIDO (`UploadedMaterial.create`) —
 *      nunca por la extensión del nombre ni por lo que declare el cliente.
 *   2. Subir el original TAL CUAL a almacenamiento. Es la promesa del brief
 *      («la escuela debe poder descargar su original»): pase lo que pase
 *      después, este paso ya terminó y el fichero está a salvo.
 *   3. Registrar el material, sin indexar todavía (`indexedAt: null`) —
 *      dentro de `uow.execute()`: si el registro fallara, el original queda
 *      huérfano en el almacén pero NUNCA hay una fila a medio construir.
 *   4. Solo PDF/DOCX: extraer texto, trocear, generar embeddings e indexar
 *      con `pgvector` — en su PROPIA transacción, separada del paso 3. Un
 *      fallo aquí (sin proveedor de embeddings configurado, por ejemplo) no
 *      deshace la subida: el material queda «subido, sin indexar todavía»,
 *      nunca a medio indexar (`markIndexed` guarda texto + fragmentos juntos,
 *      o ninguno de los dos).
 *
 * Subir material NUNCA gasta crédito — ni si falla la indexación: «la
 * subida no consume créditos, solo generar consume» (brief, verbatim).
 */
@CommandHandler(UploadMaterialCommand)
export class UploadMaterialHandler implements ICommandHandler<UploadMaterialCommand> {
  constructor(
    @Inject(MATERIAL_REPOSITORY) private readonly materials: MaterialRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(EMBEDDING_PROVIDER_PORT) private readonly embeddings: EmbeddingProviderPort,
    private readonly textExtraction: TextExtractionAdapter,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @InjectPinoLogger(UploadMaterialHandler.name) private readonly logger: PinoLogger,
  ) {}

  async execute(command: UploadMaterialCommand): Promise<{
    materialId: string;
    format: string;
    bytes: number;
    indexed: boolean;
  }> {
    const { props } = command;
    const schoolId = SchoolId.of(this.tenant.schoolId());
    const actor = this.tenant.membershipId();

    // Paso 1: tipo y tamaño de verdad, por contenido.
    const material = UploadedMaterial.create({
      bytes: props.bytes,
      declaredFilename: props.declaredFilename,
      declaredMimeType: props.declaredMimeType,
    });

    const materialId = MaterialId.of(this.ids.generate());
    const originalKey = buildMaterialStorageKey({
      schoolId: schoolId.value,
      materialId: materialId.value,
      part: "original",
      extension: material.format,
    });

    // Paso 2: el original, tal cual, a almacenamiento — antes de tocar Postgres.
    await this.storage.put({ key: originalKey, body: material.buffer, contentType: material.mimeType });

    // Paso 3: registrar el material, todavía sin indexar.
    await this.uow.execute(() =>
      this.materials.save({
        id: materialId,
        schoolId,
        format: material.format,
        originalFilename: material.declaredFilename,
        originalStorageKey: originalKey,
        originalMimeType: material.mimeType,
        originalBytes: material.bytes,
        uploadedByMembershipId: actor ? MembershipId.of(actor) : null,
        now: this.clock.now(),
      }),
    );

    if (!material.requiresTextExtraction) {
      return { materialId: materialId.value, format: material.format, bytes: material.bytes, indexed: false };
    }

    // Paso 4: extracción + indexado — un fallo aquí no deshace la subida.
    try {
      const text = await this.textExtraction.extract(material.format, material.buffer);
      const chunkTexts = splitIntoFragments(text, MAX_MATERIAL_CHUNK_CHARACTERS);

      if (chunkTexts.length === 0) {
        return { materialId: materialId.value, format: material.format, bytes: material.bytes, indexed: false };
      }

      const { vectors } = await this.embeddings.embed(chunkTexts);
      const processedKey = buildMaterialStorageKey({
        schoolId: schoolId.value,
        materialId: materialId.value,
        part: "processed",
        extension: "txt",
      });
      await this.storage.put({
        key: processedKey,
        body: Buffer.from(text, "utf8"),
        contentType: PROCESSED_MIME_TYPE,
      });

      await this.uow.execute(() =>
        this.materials.markIndexed({
          materialId,
          extractedText: text,
          processedStorageKey: processedKey,
          processedMimeType: PROCESSED_MIME_TYPE,
          chunks: chunkTexts.map((chunkText, index) => ({
            chunkIndex: index,
            text: chunkText,
            embedding: vectors[index]!,
          })),
          now: this.clock.now(),
        }),
      );

      return { materialId: materialId.value, format: material.format, bytes: material.bytes, indexed: true };
    } catch (error) {
      // El original ya está a salvo (pasos 2-3 ya terminaron): un fallo de
      // indexado deja «subido, sin indexar todavía», nunca a medias.
      this.logger.warn(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo indexar el material «${material.declaredFilename}» (${materialId.value}): la subida ` +
          "queda hecha, pero sin texto extraído ni fragmentos con embedding.",
      );
      return { materialId: materialId.value, format: material.format, bytes: material.bytes, indexed: false };
    }
  }
}
