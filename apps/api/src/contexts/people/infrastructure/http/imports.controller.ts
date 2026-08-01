import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import type { Request } from "express";
import { ClsService } from "nestjs-cls";
import { resolveLocale, type Locale } from "../../../shared/infrastructure/i18n/locale.resolver.js";
import { translateError } from "../../../shared/infrastructure/i18n/messages.js";
import { CLS_LOCALE } from "../../../shared/infrastructure/tenant/cls-tenant-context.js";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import type { ImportRowError } from "../../domain/model/import-report.vo.js";
import { ImportStudentsCommitCommand } from "../../application/commands/import-students/import-students-commit.command.js";
import { ImportStudentsPreviewCommand } from "../../application/commands/import-students/import-students-preview.command.js";
import { ImportStudentsCsvDto } from "./dto/students.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP para la importación de alumnado (Tarea 14).
 *
 * Fichero propio, no un método más de `StudentsController`: el brief lo pide
 * así, y además mantiene fuera de ese controlador una responsabilidad —
 * traducir el informe al idioma de quien importa— que no comparte con el
 * resto de rutas de `students`.
 *
 * Solo traduce y delega, igual que el resto de controladores de este
 * contexto: la validación entera vive en `analyzeStudentsCsv` (aplicación),
 * y aquí sólo se decide en qué idioma se explica cada fallo de fila. Los
 * manejadores devuelven `code`/`message`/`details` en español —el mismo
 * contrato que un `DomainError`— y esta es la única capa que sabe que existe
 * un idioma de la petición, igual que hace `AllExceptionsFilter` con los
 * errores que abortan la petición entera.
 */
@Roles("owner", "admin")
@Controller("students/import")
export class ImportsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly cls: ClsService,
  ) {}

  @Post("preview")
  @HttpCode(200)
  async preview(@Body() dto: ImportStudentsCsvDto, @Req() request: Request) {
    const result = await this.commands.execute(new ImportStudentsPreviewCommand({ csv: dto.csv }));
    const locale = this.locale(request);

    return {
      totalRows: result.totalRows,
      validCount: result.validCount,
      invalidCount: result.invalidCount,
      rows: result.rows.map((row) =>
        row.status === "invalid"
          ? { row: row.row, status: row.status, errors: this.translateErrors(row.errors, locale) }
          : row,
      ),
    };
  }

  @Post("commit")
  @HttpCode(200)
  async commit(@Body() dto: ImportStudentsCsvDto, @Req() request: Request) {
    const result = await this.commands.execute(new ImportStudentsCommitCommand({ csv: dto.csv }));
    const locale = this.locale(request);

    return {
      totalRows: result.totalRows,
      validCount: result.validCount,
      invalidCount: result.invalidCount,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      rows: result.rows.map((row) =>
        row.status === "invalid"
          ? { row: row.row, status: row.status, errors: this.translateErrors(row.errors, locale) }
          : row,
      ),
    };
  }

  /**
   * Mismo criterio que `AllExceptionsFilter`: primero el idioma ya resuelto
   * de la petición (lo fija `SessionTenantGuard` en CLS), y si no lo hay, se
   * negocia con la cabecera `Accept-Language` de esta misma petición.
   */
  private locale(request: Request): Locale {
    return (
      this.cls.get<Locale | undefined>(CLS_LOCALE) ??
      resolveLocale({ user: null, school: null, header: request.headers["accept-language"] })
    );
  }

  private translateErrors(errors: readonly ImportRowError[], locale: Locale): ImportRowError[] {
    return errors.map((error) => ({
      ...error,
      message: this.safeTranslate(error.code, locale, error.details) ?? error.message,
    }));
  }

  /**
   * Igual que el `translate` privado de `AllExceptionsFilter`: `translateError`
   * lanza si al patrón ICU le falta un parámetro, y no siempre devuelve una
   * cadena. Cualquiera de los dos casos cae al mensaje por defecto en
   * español en vez de romper la respuesta entera de la importación.
   */
  private safeTranslate(code: string, locale: Locale, details: Record<string, unknown>): string | null {
    try {
      const translated = translateError(code, locale, details);
      return typeof translated === "string" ? translated : null;
    } catch {
      return null;
    }
  }
}
