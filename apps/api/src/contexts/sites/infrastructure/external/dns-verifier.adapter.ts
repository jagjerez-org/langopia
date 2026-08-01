import { Injectable } from "@nestjs/common";
import { resolveTxt } from "node:dns/promises";
import type { DnsVerifierPort } from "../../domain/ports/dns-verifier.port.js";

@Injectable()
export class NodeDnsVerifierAdapter implements DnsVerifierPort {
  async resolveTxt(name: string): Promise<readonly string[]> {
    const records = await resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  }
}
