import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export class InvalidSiteBlockError extends DomainError {
  readonly code = "invalid_site_block";
  readonly kind = "invalid_input" as const;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

export class InvalidSitePageError extends DomainError {
  readonly code = "invalid_site_page";
  readonly kind = "invariant_violation" as const;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

export class InvalidSiteError extends DomainError {
  readonly code = "invalid_site";
  readonly kind = "invariant_violation" as const;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

export class InvalidSiteDomainError extends DomainError {
  readonly code = "invalid_site_domain";
  readonly kind = "invalid_input" as const;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

export class DuplicateSiteDomainError extends DomainError {
  readonly code = "duplicate_site_domain";
  readonly kind = "conflict" as const;

  constructor(hostname: string) {
    super(`El dominio ${hostname} ya está dado de alta.`, { hostname });
  }
}
