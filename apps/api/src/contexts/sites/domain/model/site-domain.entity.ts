import { InvalidSiteDomainError } from "../errors/sites.errors.js";

const VERIFICATION_HOURS = 48;

export const SiteDomainStatus = {
  Pending: "pending",
  Verified: "verified",
  Failed: "failed",
} as const;

export type SiteDomainStatus = (typeof SiteDomainStatus)[keyof typeof SiteDomainStatus];

export const SiteDomainTlsStatus = {
  Pending: "pending",
  Issued: "issued",
  Noop: "noop",
  Failed: "failed",
} as const;

export type SiteDomainTlsStatus =
  (typeof SiteDomainTlsStatus)[keyof typeof SiteDomainTlsStatus];

export type SiteDomainVerificationInstruction = {
  type: "TXT";
  name: string;
  value: string;
};

export type SiteDomainView = {
  id: string;
  hostname: string;
  status: SiteDomainStatus;
  isPrimary: boolean;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  tlsIssuedAt: string | null;
  tlsStatus: SiteDomainTlsStatus;
  verification: SiteDomainVerificationInstruction;
};

export class SiteDomain {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: string,
    private readonly _hostname: string,
    private readonly _verificationToken: string,
    private readonly _createdAt: Date,
    private readonly _expiresAt: Date,
    private _status: SiteDomainStatus,
    private readonly _isPrimary: boolean,
    private _verifiedAt: Date | null,
    private _failedAt: Date | null,
    private _failureReason: string | null,
    private _tlsIssuedAt: Date | null,
    private _tlsStatus: SiteDomainTlsStatus,
  ) {}

  static request(params: {
    id: string;
    schoolId: string;
    hostname: string;
    verificationToken: string;
    now: Date;
  }): SiteDomain {
    const token = normalizeVerificationToken(params.verificationToken);
    const createdAt = new Date(params.now);
    return new SiteDomain(
      requireText(params.id, "id del dominio"),
      requireText(params.schoolId, "id de escuela"),
      normalizeHostname(params.hostname),
      token,
      createdAt,
      new Date(createdAt.getTime() + VERIFICATION_HOURS * 60 * 60 * 1000),
      SiteDomainStatus.Pending,
      false,
      null,
      null,
      null,
      null,
      SiteDomainTlsStatus.Pending,
    );
  }

  static rehydrate(params: {
    id: string;
    schoolId: string;
    hostname: string;
    verificationToken: string;
    createdAt: Date;
    expiresAt: Date;
    status: SiteDomainStatus;
    isPrimary: boolean;
    verifiedAt: Date | null;
    failedAt: Date | null;
    failureReason: string | null;
    tlsIssuedAt: Date | null;
    tlsStatus: SiteDomainTlsStatus;
  }): SiteDomain {
    return new SiteDomain(
      requireText(params.id, "id del dominio"),
      requireText(params.schoolId, "id de escuela"),
      normalizeHostname(params.hostname),
      normalizeVerificationToken(params.verificationToken),
      params.createdAt,
      params.expiresAt,
      params.status,
      params.isPrimary,
      params.verifiedAt,
      params.failedAt,
      params.failureReason,
      params.tlsIssuedAt,
      params.tlsStatus,
    );
  }

  verifyDns(txtRecords: readonly string[], now: Date): boolean {
    if (this._status !== SiteDomainStatus.Pending) return this._status === SiteDomainStatus.Verified;
    if (this.isExpired(now)) {
      this.markFailedIfExpired(now);
      return false;
    }
    const found = txtRecords.some((record) => record.includes(this._verificationToken));
    if (!found) return false;

    this._status = SiteDomainStatus.Verified;
    this._verifiedAt = new Date(now);
    this._failedAt = null;
    this._failureReason = null;
    return true;
  }

  markFailedIfExpired(now: Date): boolean {
    if (this._status !== SiteDomainStatus.Pending || !this.isExpired(now)) return false;
    this._status = SiteDomainStatus.Failed;
    this._failedAt = new Date(now);
    this._failureReason = "No se encontró el registro TXT de verificación en 48 horas.";
    return true;
  }

  markTlsIssued(now: Date): void {
    this._tlsIssuedAt = new Date(now);
    this._tlsStatus = SiteDomainTlsStatus.Issued;
  }

  markTlsNoop(): void {
    this._tlsStatus = SiteDomainTlsStatus.Noop;
  }

  markTlsFailed(reason: string): void {
    this._tlsStatus = SiteDomainTlsStatus.Failed;
    this._failureReason = reason;
  }

  toView(): SiteDomainView {
    return {
      id: this._id,
      hostname: this._hostname,
      status: this._status,
      isPrimary: this._isPrimary,
      createdAt: this._createdAt.toISOString(),
      expiresAt: this._expiresAt.toISOString(),
      verifiedAt: this._verifiedAt?.toISOString() ?? null,
      failedAt: this._failedAt?.toISOString() ?? null,
      failureReason: this._failureReason,
      tlsIssuedAt: this._tlsIssuedAt?.toISOString() ?? null,
      tlsStatus: this._tlsStatus,
      verification: this.verificationInstruction,
    };
  }

  get verificationInstruction(): SiteDomainVerificationInstruction {
    return {
      type: "TXT",
      name: `_langopia.${this._hostname}`,
      value: this._verificationToken,
    };
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get hostname(): string {
    return this._hostname;
  }

  get verificationToken(): string {
    return this._verificationToken;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get status(): SiteDomainStatus {
    return this._status;
  }

  get isPrimary(): boolean {
    return this._isPrimary;
  }

  get verifiedAt(): Date | null {
    return this._verifiedAt;
  }

  get failedAt(): Date | null {
    return this._failedAt;
  }

  get failureReason(): string | null {
    return this._failureReason;
  }

  get tlsIssuedAt(): Date | null {
    return this._tlsIssuedAt;
  }

  get tlsStatus(): SiteDomainTlsStatus {
    return this._tlsStatus;
  }

  private isExpired(now: Date): boolean {
    return now.getTime() > this._expiresAt.getTime();
  }
}

export function normalizeHostname(value: string): string {
  const raw = requireText(value, "hostname").toLowerCase();
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.includes("/")) {
    throw new InvalidSiteDomainError("Escribe solo el dominio, sin protocolo ni ruta.", { hostname: value });
  }
  const withoutPort = raw.replace(/:\d+$/, "");
  const hostname = withoutPort.replace(/\.$/, "");
  if (
    hostname.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      hostname,
    )
  ) {
    throw new InvalidSiteDomainError("El dominio no tiene un formato válido.", { hostname: value });
  }
  return hostname;
}

function normalizeVerificationToken(value: string): string {
  const token = requireText(value, "token de verificación");
  return token.startsWith("langopia-domain-verification_")
    ? token
    : `langopia-domain-verification_${token}`;
}

function requireText(value: string, field: string): string {
  const text = value.trim();
  if (text.length === 0) throw new InvalidSiteDomainError(`El campo ${field} es obligatorio.`);
  return text;
}
