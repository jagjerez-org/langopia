import { Inject } from "@nestjs/common";
import { CommandBus, CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MaterialNotIndexedError } from "../../../domain/errors/learning.errors.js";
import { ContentUnitId, MaterialId } from "../../../domain/model/identifiers.js";
import {
  EMBEDDING_PROVIDER_PORT,
  type EmbeddingProviderPort,
} from "../../../domain/ports/embedding-provider.port.js";
import {
  MATERIAL_REPOSITORY,
  type MaterialRepository,
} from "../../../domain/ports/material.repository.port.js";
import { GenerateUnitCommand } from "../generate-unit/generate-unit.command.js";
import { CreateUnitFromMaterialCommand } from "./create-unit-from-material.command.js";

/**
 * Cuántos fragmentos del material se le pasan al modelo como fuente.
 *
 * Seis, no el documento entero: el valor de indexar con `pgvector` es
 * precisamente no mandarlo todo — un cuaderno de 80 páginas no cabe en una
 * petición, y aunque cupiera, ahogar el tema pedido entre 79 páginas que no
 * vienen a cuento produce ejercicios peores, no mejores.
 */
export const RELEVANT_CHUNKS_FOR_GENERATION = 6;

/**
 * Texto que se busca por cercanía semántica dentro del material: el tema
 * pedido y las destrezas que se quieren trabajar, que es exactamente lo que
 * debe guiar qué pasajes se recuperan.
 */
export function buildRetrievalQuery(topic: string, skills: string[]): string {
  return skills.length > 0 ? `${topic} (${skills.join(", ")})` : topic;
}

/**
 * Une los fragmentos recuperados en el `sourceMaterial` que recibe el
 * modelo. Numerados y separados: el modelo tiene que poder apoyarse en un
 * pasaje concreto del material de la escuela, no en un batiburrillo.
 */
export function buildSourceMaterial(chunks: Array<{ chunkIndex: number; text: string }>): string {
  return chunks.map((chunk) => `[fragmento ${chunk.chunkIndex + 1}]\n${chunk.text}`).join("\n\n");
}

/**
 * Manejador del comando: una unidad `hybrid` —material propio de la escuela
 * como fuente, ejercicios generados encima— a partir de un material ya
 * subido e indexado.
 *
 * Cuatro pasos, y el orden importa:
 *
 *   1. El material tiene que existir y estar INDEXADO. Un mp3 o un jpg no
 *      llevan texto que extraer; un pdf cuya indexación falló (sin proveedor
 *      de embeddings en este entorno, por ejemplo) tampoco sirve todavía.
 *      Las dos cosas son el mismo `MaterialNotIndexedError`, y se comprueban
 *      ANTES de gastar ninguna llamada ni reservar ningún crédito.
 *   2. Se busca en ESE material, por cercanía semántica al tema y las
 *      destrezas pedidas, los fragmentos que de verdad vienen a cuento.
 *   3. Se delega en `GenerateUnitCommand` —el mismo caso de uso de la tarea
 *      6, con su reserva de créditos, su registro de coste en
 *      `ai_generations`, su validación por esquema y su reintento— pasándole
 *      esos fragmentos como `sourceMaterial` y `source: "hybrid"`. Que una
 *      unidad venga del material de la escuela no relaja NADA: sigue naciendo
 *      en `in_review` y sigue necesitando la firma de un profesor.
 *   4. Se ata el material a la unidad que salió de él, para que quien mire la
 *      unidad sepa de dónde vino.
 *
 * Sin fragmentos relevantes no se genera nada: se trata igual que un material
 * sin indexar, porque el resultado sería una unidad «sobre el material» que
 * no cita el material — justo lo que la tarea existe para evitar.
 */
@CommandHandler(CreateUnitFromMaterialCommand)
export class CreateUnitFromMaterialHandler implements ICommandHandler<CreateUnitFromMaterialCommand> {
  constructor(
    @Inject(MATERIAL_REPOSITORY) private readonly materials: MaterialRepository,
    @Inject(EMBEDDING_PROVIDER_PORT) private readonly embeddings: EmbeddingProviderPort,
    private readonly commands: CommandBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(
    command: CreateUnitFromMaterialCommand,
  ): Promise<{ contentUnitId: string; status: string; materialId: string; chunksUsed: number }> {
    const { props } = command;
    const materialId = MaterialId.of(props.materialId);

    // Paso 1: existe y está indexado.
    const material = await this.uow.read(() => this.materials.findById(materialId));
    if (!material) throw new NotFoundError("el material", props.materialId);
    if (!material.indexedAt || !material.extractedText) {
      throw new MaterialNotIndexedError(props.materialId);
    }

    // Paso 2: los pasajes del material que vienen a cuento, y solo esos.
    const { vectors } = await this.embeddings.embed([buildRetrievalQuery(props.topic, props.skills)]);
    const queryEmbedding = vectors[0];
    if (!queryEmbedding) throw new MaterialNotIndexedError(props.materialId);

    const chunks = await this.uow.read(() =>
      this.materials.findRelevantChunks({
        materialId,
        queryEmbedding,
        limit: RELEVANT_CHUNKS_FOR_GENERATION,
      }),
    );
    if (chunks.length === 0) throw new MaterialNotIndexedError(props.materialId);

    // Paso 3: el mismo caso de uso de siempre, con el material real como fuente.
    const generated = await this.commands.execute(
      new GenerateUnitCommand({
        code: props.code,
        language: props.language,
        level: props.level,
        topic: props.topic,
        skills: props.skills,
        primaryLocale: props.primaryLocale,
        exerciseTypes: props.exerciseTypes,
        sourceMaterial: buildSourceMaterial(chunks),
        source: "hybrid",
      }),
    );

    // Paso 4: el material queda atado a la unidad que salió de él.
    await this.uow.execute(() =>
      this.materials.linkToContentUnit({
        materialId,
        contentUnitId: ContentUnitId.of(generated.contentUnitId),
      }),
    );

    return {
      contentUnitId: generated.contentUnitId,
      status: generated.status,
      materialId: materialId.value,
      chunksUsed: chunks.length,
    };
  }
}
