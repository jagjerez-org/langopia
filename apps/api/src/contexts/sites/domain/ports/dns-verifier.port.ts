export const DNS_VERIFIER = Symbol("DnsVerifier");

export interface DnsVerifierPort {
  resolveTxt(name: string): Promise<readonly string[]>;
}
