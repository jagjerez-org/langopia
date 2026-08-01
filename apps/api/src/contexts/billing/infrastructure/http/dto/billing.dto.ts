import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { InvoiceStatus } from "../../../domain/model/invoice-status.js";

/**
 * DTOs de entrada: validan la FORMA, no las reglas de negocio. Que la
 * comisión se congele, que no se cobre ni se devuelva de más, lo decide el
 * dominio (`Invoice`), nunca este fichero — `SchedulingController` y
 * `CatalogController` siguen el mismo reparto.
 */

class InvoiceLineDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  /** En céntimos enteros. Nunca coma flotante. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitCents!: number;

  @IsOptional()
  @IsUUID()
  courseId?: string | null;

  @IsOptional()
  @IsUUID()
  sessionId?: string | null;
}

export class IssueInvoiceDto {
  @IsIn(["platform_to_school", "school_to_student"])
  direction!: "platform_to_school" | "school_to_student";

  @IsOptional()
  @IsUUID()
  studentId?: string | null;

  @IsOptional()
  @IsUUID()
  billToMembershipId?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  taxRateBps?: number;

  @IsISO8601()
  dueOn!: string;
}

export class RecordPaymentDto {
  @IsEmail()
  payerEmail!: string;

  @IsOptional()
  @IsString()
  payerProviderCustomerRef?: string | null;

  /** Céntimos a cobrar. Por defecto, lo que queda pendiente de la factura. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents?: number | null;

  @IsOptional()
  @IsString()
  method?: string;

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}

const REFUND_REASONS = [
  "requested_by_customer",
  "service_not_provided",
  "duplicate",
  "fraudulent",
  "goodwill",
] as const;

export class RefundPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsIn(REFUND_REASONS)
  reason!: (typeof REFUND_REASONS)[number];

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}

const INVOICE_STATUSES = Object.values(InvoiceStatus) as readonly InvoiceStatus[];

/** Query de `GET /billing/invoices` (Tarea 10 del panel, Paso 1). */
export class ListInvoicesQueryDto {
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;
}

export class StartConnectOnboardingDto {
  /** A dónde vuelve la escuela al completar el trámite en el proveedor de pago. */
  @IsString()
  @MinLength(1)
  returnUrl!: string;

  /** A dónde vuelve si el enlace caduca o falla antes de completarlo. */
  @IsString()
  @MinLength(1)
  refreshUrl!: string;
}
