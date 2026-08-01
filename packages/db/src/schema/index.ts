/**
 * Esquema completo de Langopia.
 *
 * Regla que no admite excepción: toda tabla que contenga datos de una escuela
 * lleva `schoolId` y una política RLS en `src/db/policies.sql`.
 *
 * Las únicas tablas globales, y el motivo de que lo sean:
 *   - `users` → una persona puede pertenecer a varias escuelas
 *   - `plans` → el catálogo de planes es tuyo, no de cada escuela
 *   - `user`, `session`, `account`, `verification` → tablas de Better Auth:
 *     guardan la credencial, no los datos de una escuela
 */

export * from "./enums.js";
export * from "./auth.js";
export * from "./tenancy.js";
export * from "./people.js";
export * from "./catalog.js";
export * from "./scheduling.js";
export * from "./content.js";
export * from "./assessment.js";
export * from "./feedback.js";
export * from "./billing.js";
export * from "./media.js";
export * from "./platform.js";
export * from "./sites.js";
