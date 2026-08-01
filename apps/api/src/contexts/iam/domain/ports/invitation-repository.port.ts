import type { Invitation } from "../model/invitation.aggregate.js";

export interface InvitationRepositoryPort {
  save(invitation: Invitation): Promise<void>;

  /** Lectura normal, con tenant ya fijado: solo ve invitaciones de la escuela activa. */
  findByToken(token: string): Promise<Invitation | null>;

  /**
   * A qué escuela pertenece un token, ANTES de que haya tenant que fijar.
   *
   * Mismo huevo y la gallina que `MembershipLookupPort.activeFor`: quien
   * llega a `POST /invitations/:token/accept` no pertenece todavía a
   * ninguna escuela, así que no hay `app.school_id` que poner antes de
   * preguntar. Se apoya en `school_id_for_invitation_token`, la función
   * `SECURITY DEFINER` del fichero de políticas del paquete de datos que
   * solo devuelve el identificador de la escuela, nada más de la invitación.
   */
  schoolIdForToken(token: string): Promise<string | null>;
}

export const INVITATION_REPOSITORY = Symbol("InvitationRepositoryPort");
