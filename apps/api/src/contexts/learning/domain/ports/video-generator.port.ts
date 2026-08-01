export type PublishedUnitVideoInput = {
  contentUnitId: string;
  code: string;
  language: string;
  level: string;
  topic: string;
  primaryLocale: string;
};

/**
 * Vídeo beta de una unidad ya publicada.
 *
 * Es best-effort por diseño de producto: si el proveedor falta o falla, la
 * unidad publicada sigue disponible para el alumno.
 */
export interface VideoGeneratorPort {
  generateBetaVideoForPublishedUnit(unit: PublishedUnitVideoInput): Promise<void>;
}

export const VIDEO_GENERATOR_PORT = Symbol("VideoGeneratorPort");
