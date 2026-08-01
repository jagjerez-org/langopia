import type { CancellationPolicy } from "../model/cancellation-policy.js";

/**
 * La configuración de la escuela que afecta a la programación de clases.
 *
 * Vive en el contexto de tenants, no aquí, así que se pide por un puerto. Si
 * mañana la política de cancelación se vuelve configurable por curso en vez
 * de por escuela, cambia la implementación y no el dominio.
 */
export interface SchoolSchedulingPolicyPort {
  cancellationPolicy(): Promise<CancellationPolicy>;
  timezone(): Promise<string>;
}

export const SCHOOL_SCHEDULING_POLICY_PORT = Symbol("SchoolSchedulingPolicyPort");
