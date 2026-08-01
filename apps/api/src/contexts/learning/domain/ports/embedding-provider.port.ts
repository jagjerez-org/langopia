/**
 * Puerto de generación de embeddings de texto para `learning`.
 *
 * Es una capacidad distinta de `ContentGeneratorPort` (que genera texto) y
 * de `MediaGeneratorPort` (que genera audio e imagen): aquí no se genera
 * contenido, se convierte texto ya existente —el que se extrae de un PDF o
 * DOCX subido— en un vector, que es lo que permite indexarlo con `pgvector`
 * y luego recuperar solo los fragmentos semánticamente relevantes al
 * generar ejercicios sobre ese material (tarea 14 de la ola 2).
 *
 * El dominio no sabe qué proveedor hay detrás ni cómo se calcula el vector;
 * el adaptador decide el modelo y el contrato HTTP. A diferencia de
 * `ContentGeneratorPort`/`MediaGeneratorPort`, no devuelve un coste: indexar
 * material propio no consume créditos de la escuela («la subida no consume
 * créditos, solo generar consume» — brief de la tarea), así que no hay
 * margen que vigilar aquí.
 */
export interface EmbeddingProviderPort {
  /**
   * Un vector por cada texto de `texts`, en el mismo orden. Vacío si
   * `texts` está vacío: no hace falta ninguna llamada real para no indexar
   * nada.
   */
  embed(texts: string[]): Promise<{ vectors: number[][]; model: string }>;
}

export const EMBEDDING_PROVIDER_PORT = Symbol("EmbeddingProviderPort");
