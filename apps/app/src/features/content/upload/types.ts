/**
 * Formas de `MaterialsController` (`apps/api/src/contexts/learning/
 * infrastructure/http/materials.controller.ts`), Tarea 14 de la ola 2.
 */

/** Espejo de `material_format` (`packages/db/src/schema/enums.ts`). Es la lista con la que la API rechaza cualquier otro formato. */
export const MATERIAL_FORMATS = ["pdf", "docx", "mp3", "wav", "mp4", "jpg", "png"] as const;
export type MaterialFormat = (typeof MATERIAL_FORMATS)[number];

/** Respuesta de `POST /learning/materials`. */
export interface UploadMaterialResult {
  materialId: string;
  format: string;
  bytes: number;
  /**
   * Si el material quedó indexado (texto extraído y fragmentos con
   * embedding). Solo un PDF o un DOCX pueden estarlo, y solo si el proveedor
   * de embeddings respondió: lo decide la API, no esta pantalla.
   */
  indexed: boolean;
}

/** Cuerpo de `POST /learning/units/from-material`. */
export interface CreateUnitFromMaterialInput {
  materialId: string;
  code: string;
  language: string;
  level: string;
  topic: string;
  skills: string[];
  primaryLocale: string;
  exerciseTypes: string[];
}

export interface CreateUnitFromMaterialResult {
  contentUnitId: string;
  status: string;
  materialId: string;
  /** Cuántos fragmentos del material se le pasaron al modelo como fuente. */
  chunksUsed: number;
}

/** Un fichero en la cola de subida, con lo que la pantalla necesita pintar de él. */
export type UploadItem = {
  /** Identificador local de la fila; no tiene nada que ver con `materialId`. */
  key: string;
  filename: string;
  bytes: number;
  status: "uploading" | "done" | "failed";
  /** 0–100. Lo reporta el navegador, no se estima. */
  percent: number;
  result?: UploadMaterialResult;
  error?: string;
};
