import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq } from "drizzle-orm";
import type { RoomProvider } from "../../domain/model/room-provider.js";
import type { SessionRoomPort, SessionRoomSnapshot } from "../../domain/ports/session-room.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

/**
 * `sessions.room_provider`, `.room_url` y `.room_external_id` son columnas de
 * la tabla que `scheduling` gobierna, pero crear y borrar la sala es trabajo
 * de `classroom` (ver ARCHITECTURE.md, tarea 6 del plan de la ola 1).
 * `classroom` no importa el repositorio de `scheduling` para escribirlas —
 * cruzar así la frontera invertiría la dependencia—; este repositorio, propio
 * de `classroom`, toca directamente esas tres columnas, igual que
 * `DrizzleSchoolDirectoryRepository` ya lee `schools` sin pertenecer a su
 * contexto. Ninguna consulta filtra por `school_id` a mano: la conexión usa
 * el rol `langopia_app` y la unidad de trabajo fija `app.school_id`, así que
 * las políticas RLS filtran por debajo.
 */
@Injectable()
export class DrizzleSessionRoomRepository implements SessionRoomPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(sessionId: string): Promise<SessionRoomSnapshot | null> {
    const [row] = await this.drizzle.db
      .select({
        id: schema.sessions.id,
        schoolId: schema.sessions.schoolId,
        roomProvider: schema.sessions.roomProvider,
        roomUrl: schema.sessions.roomUrl,
        roomExternalId: schema.sessions.roomExternalId,
      })
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));

    if (!row) return null;

    return {
      sessionId: row.id,
      schoolId: row.schoolId,
      provider: row.roomProvider as RoomProvider,
      url: row.roomUrl,
      externalId: row.roomExternalId,
    };
  }

  async attachRoom(params: {
    sessionId: string;
    url: string | null;
    externalId: string | null;
  }): Promise<void> {
    await this.drizzle.db
      .update(schema.sessions)
      .set({ roomUrl: params.url, roomExternalId: params.externalId })
      .where(eq(schema.sessions.id, params.sessionId));
  }
}
