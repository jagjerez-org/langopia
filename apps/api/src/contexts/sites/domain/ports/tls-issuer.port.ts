export const TLS_ISSUER = Symbol("TlsIssuer");

export interface TlsIssuerPort {
  issueCertificate(hostname: string): Promise<{ issued: boolean; reason?: string }>;
}
