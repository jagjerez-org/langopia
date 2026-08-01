import type { ICommand } from "@nestjs/cqrs";

/**
 * Subir material propio de la escuela.
 *
 * `bytes` viaja como `Buffer` ya en memoria — el adaptador HTTP
 * (`materials.controller.ts`) es quien lo saca de la petición multiparte;
 * este comando no sabe que existe `multipart/form-data`.
 */
export class UploadMaterialCommand implements ICommand {
  constructor(
    readonly props: {
      bytes: Buffer;
      declaredFilename: string;
      declaredMimeType?: string;
    },
  ) {}
}
