/**
 * Verificación de identidad de un comerciante, hacia el proveedor de pago.
 *
 * Existe para que el dominio no dependa de ninguno en concreto: cada
 * proveedor de pago del mercado difiere en sus propios estados de
 * verificación, en sus requisitos y en quién asume el riesgo. Cambiar de
 * proveedor implica reescribir el adaptador entero y volver a verificar a
 * cada escuela — coste asumido, no deuda. Lo que sí se gana separándolo de
 * `PaymentGatewayPort`: cobrar y devolver siguen siendo portables aunque
 * esta pieza no lo sea.
 */
export type MerchantOnboardingLink = {
  /** Referencia de la cuenta en el proveedor. La misma que ya tenía la escuela, o una nueva. */
  merchantRef: string;
  /** URL a la que redirigir al comerciante para completar (o revisar) su verificación. */
  onboardingUrl: string;
};

export interface MerchantOnboardingPort {
  /**
   * Da de alta (o continúa) el trámite de verificación y devuelve la URL de
   * onboarding alojada por el proveedor.
   *
   * `merchantRef` es `null` la primera vez que una escuela empieza el
   * trámite; en llamadas posteriores —el comerciante no terminó, o quiere
   * revisar sus datos— se reutiliza la cuenta ya creada, nunca se crea una
   * segunda.
   */
  createOnboardingLink(params: {
    merchantRef: string | null;
    /** País de la escuela, ISO-3166 de dos letras. Lo pide el proveedor al crear la cuenta. */
    country: string;
    /** A dónde vuelve el comerciante al completar el trámite. */
    returnUrl: string;
    /** A dónde vuelve si el enlace caduca o falla antes de completarlo. */
    refreshUrl: string;
  }): Promise<MerchantOnboardingLink>;
}

export const MERCHANT_ONBOARDING_PORT = Symbol("MerchantOnboardingPort");
