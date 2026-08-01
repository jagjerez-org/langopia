import { Inject, Injectable } from "@nestjs/common";
import { OBJECT_STORAGE, type ObjectStoragePort } from "../../../shared/domain/ports/object-storage.port.js";
import type { StoredMediaAsset } from "../../domain/ports/media-generator.port.js";

/** Los cuatro tipos de fichero que puede llevar una unidad (`asset_kind` en `packages/db/src/schema/enums.ts`). */
export type ContentAssetKind = "audio" | "image" | "video" | "document";

/**
 * Construye la clave de almacenamiento de un fichero de una unidad:
 * `{escuela}/units/{código}/{tipo}-{n}` (decisión común de la tarea 4, ola 2).
 *
 * Función pura, sin efectos: se prueba sola, sin dobles de ningún proveedor.
 */
export function buildContentAssetStorageKey(params: {
  schoolKey: string;
  unitCode: string;
  kind: ContentAssetKind;
  sequence: number;
}): string {
  return `${params.schoolKey}/units/${params.unitCode}/${params.kind}-${params.sequence}`;
}

/**
 * Almacenamiento de los ficheros que produce `learning`: audio e imágenes
 * (y, más adelante, vídeo — tarea 10, beta). No es en sí un puerto de
 * `learning`: es un colaborador interno de `TtsAdapter` e `ImageAdapter`
 * (igual que `stripe-http.ts` en `billing` no es `PaymentGatewayPort`, solo
 * ayuda a implementarlo), que delega la subida de verdad en el almacén de
 * objetos compartido (`ObjectStoragePort`, `shared`) — el mismo que ya usan
 * `classroom` e `iam` para borrar grabaciones.
 */
@Injectable()
export class ContentAssetStorageAdapter {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort) {}

  async store(params: {
    schoolKey: string;
    unitCode: string;
    kind: ContentAssetKind;
    sequence: number;
    body: Buffer;
    contentType: string;
  }): Promise<StoredMediaAsset> {
    const storageKey = buildContentAssetStorageKey(params);
    await this.storage.put({ key: storageKey, body: params.body, contentType: params.contentType });
    return { storageKey, mimeType: params.contentType, bytes: params.body.byteLength };
  }
}
