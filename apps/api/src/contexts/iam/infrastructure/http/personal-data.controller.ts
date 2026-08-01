import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import {
  RestrictedWhileImpersonating,
  Roles,
} from "../../../shared/infrastructure/http/roles.decorator.js";
import { ErasePersonCommand } from "../../application/commands/erase-person/erase-person.command.js";
import { ExportPersonalDataQuery } from "../../application/queries/export-personal-data/export-personal-data.handler.js";

/**
 * Adaptador de ENTRADA sobre HTTP: derecho de acceso, portabilidad y borrado
 * (Tarea 15, RGPD).
 *
 * Vive en `iam` (identidad), aunque las rutas empiecen por `/people`: es lo
 * que pide el brief, verbatim. Encaja igual: lo que se exporta o se borra es
 * la IDENTIDAD de una persona (`users`), aunque los datos que arrastra vivan
 * repartidos por `people`, `catalog`, `scheduling`, `assessment`, `classroom`
 * y `billing`.
 *
 * `export`: sin restricción de rol más allá de estar autenticado — la propia
 * persona, su tutor, o dirección — porque QUIÉN puede pedirlo de verdad no es
 * una cuestión de rol sino de RELACIÓN con el objetivo
 * (`canAccessPersonalData`, dentro del manejador). Un rol amplio aquí y una
 * denegación fina dentro es el mismo patrón que ya usa
 * `StudentPortalController`.
 *
 * `erase`: exclusivamente `owner` (brief, verbatim: «Un borrado es
 * irreversible y requiere rol owner»). Ni tutor ni auto-servicio valen aquí:
 * decide siempre la dirección.
 *
 * Las dos rutas llevan `@RestrictedWhileImpersonating("data_export_or_erasure")`
 * (Tarea 17, en curso a la vez en `iam`): soporte de la plataforma actuando
 * como otra persona no puede usarlas — convertiría el soporte en una vía de
 * exfiltración, justo el riesgo que ese guardia corta. El valor es el
 * literal que declara `FORBIDDEN_WHILE_IMPERSONATING`
 * (`domain/model/impersonation-rules.ts`); no se importa esa constante desde
 * aquí a propósito, para no acoplar este controlador a un fichero que la
 * Tarea 17 puede seguir cambiando de forma independiente.
 */
@Controller("people")
export class PersonalDataController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Roles("owner", "admin", "teacher", "student", "guardian")
  @RestrictedWhileImpersonating("data_export_or_erasure")
  @Get(":membershipId/export")
  async export(@Param("membershipId", ParseUUIDPipe) membershipId: string) {
    return this.queries.execute(new ExportPersonalDataQuery({ membershipId }));
  }

  @Roles("owner")
  @RestrictedWhileImpersonating("data_export_or_erasure")
  @Post(":membershipId/erase")
  @HttpCode(200)
  async erase(@Param("membershipId", ParseUUIDPipe) membershipId: string) {
    return this.commands.execute(new ErasePersonCommand({ membershipId }));
  }
}
