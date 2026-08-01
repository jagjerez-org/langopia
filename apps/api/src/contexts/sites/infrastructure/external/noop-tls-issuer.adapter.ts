import { Injectable } from "@nestjs/common";
import type { TlsIssuerPort } from "../../domain/ports/tls-issuer.port.js";

@Injectable()
export class NoopTlsIssuerAdapter implements TlsIssuerPort {
  async issueCertificate(): Promise<{ issued: boolean; reason: string }> {
    return {
      issued: false,
      reason: "No hay infraestructura TLS configurada en este entorno.",
    };
  }
}
