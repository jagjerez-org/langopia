/**
 * Lo que `people` necesita de `iam`, y nada más.
 *
 * Crear un usuario global y su membresía es competencia de identidad. Aquí
 * solo se pide «dame el id de membresía de esta persona en esta escuela, y
 * créala si hace falta».
 */
export interface MembershipProvisioningPort {
  provisionStudent(params: { name: string; email: string; locale: string | null }): Promise<string>;

  provisionGuardian(params: {
    name: string;
    email: string;
    locale: string | null;
  }): Promise<string>;

  /**
   * Ficha de profesor. La misma persona puede dar clase en dos escuelas — el
   * usuario es global, y aquí se le da o reutiliza una membresía por cada
   * una.
   */
  provisionTeacher(params: { name: string; email: string; locale: string | null }): Promise<string>;
}

export const MEMBERSHIP_PROVISIONING_PORT = Symbol("MembershipProvisioningPort");

/**
 * Los roles que este puerto puede aprovisionar son un conjunto cerrado. Es un
 * subconjunto de `membershipRole` a propósito: por aquí no se crea un `owner`
 * ni un `admin`.
 */
export const ProvisionedRole = {
  Student: "student",
  Guardian: "guardian",
  Teacher: "teacher",
} as const;

export type ProvisionedRole = (typeof ProvisionedRole)[keyof typeof ProvisionedRole];
