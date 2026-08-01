import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { SiteDomainTokenGenerator } from "../../domain/ports/site-domain-token-generator.port.js";

@Injectable()
export class CryptoSiteDomainTokenGenerator implements SiteDomainTokenGenerator {
  generate(): string {
    return randomBytes(24).toString("base64url");
  }
}
