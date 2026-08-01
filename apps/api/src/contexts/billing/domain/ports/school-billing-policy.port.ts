/**
 * La configuración de la escuela que afecta a la facturación.
 *
 * Igual que `SchoolLocalePort` en `catalog` o `SchoolSchedulingPolicyPort` en
 * `scheduling`: vive en el contexto de tenants (`schools`), no aquí, así que
 * se pide por un puerto. Es la única vía por la que `issue-invoice` conoce la
 * comisión de plataforma pactada — y solo la conoce en el instante de emitir,
 * nunca después.
 */
/** Estado del alta del comerciante, en NUESTRO vocabulario — nunca el del proveedor. */
export type MerchantStatus = "active" | "restricted";

export interface SchoolBillingPolicyPort {
  /** Moneda de la escuela (`schools.currency`). Toda factura se emite en ella. */
  currency(): Promise<string>;

  /** Idioma por defecto, para la factura de quien no tiene uno propio. */
  defaultLocale(): Promise<string>;

  /** País de la escuela (`schools.country`, ISO-3166 de dos letras). Lo pide el alta de comerciante. */
  country(): Promise<string>;

  /** Comisión de plataforma vigente AHORA MISMO. `Invoice.issue()` la congela. */
  applicationFee(): Promise<{ enabled: boolean; bps: number; capCents: number | null }>;

  /** Cuenta conectada del proveedor de pago de la escuela. `null` si no la tiene todavía. */
  merchantRef(): Promise<string | null>;

  /**
   * Registra la cuenta de comerciante recién creada (o reutilizada) tras
   * iniciar el trámite de alta. Pasa `merchant_status` a `pending` solo la
   * primera vez —si ya estaba `active`/`restricted`/`pending`, un nuevo
   * enlace de onboarding (para completar datos, por ejemplo) no la hace
   * retroceder.
   */
  saveMerchantOnboarding(merchantRef: string): Promise<void>;

  /**
   * El proveedor de pago confirmó (`account.updated` traducido) que la
   * cuenta ya cobra, o que le faltan datos y está restringida. El estado que
   * se guarda es el nuestro (`active`/`restricted`), nunca el nombre que use
   * el proveedor.
   */
  updateMerchantStatus(status: MerchantStatus): Promise<void>;
}

export const SCHOOL_BILLING_POLICY_PORT = Symbol("SchoolBillingPolicyPort");
