import type { ReactElement } from "react";
import type { AgendaEntry } from "@langopia/contracts";
import { Link } from "@tanstack/react-router";
import { formatDate } from "../../i18n/format.js";
import type { Locale } from "../../i18n/locale.js";
import { useT } from "../../i18n/translate.js";
import { Button, Dialog } from "@langopia/ui";

export interface SessionMenuDialogProps {
  open: boolean;
  session: AgendaEntry;
  timeZone: string;
  locale: Locale;
  onClose: () => void;
  onChooseReschedule: () => void;
  onChooseCancel: () => void;
  onChooseAttendance: () => void;
}

/**
 * Detalles de una clase y sus acciones (activar una tarjeta de `WeekGrid`
 * abre esto). Es también la alternativa de teclado a arrastrar y soltar: con
 * el foco en la clase, Intro/clic abre este menú, y "Reprogramar" lleva al
 * mismo diálogo de confirmación que usaría soltar la clase en otro hueco.
 *
 * Las acciones se ofrecen siempre, sin importar el estado de la clase: el
 * panel no decide qué está permitido —eso es lógica de negocio—, lo decide
 * la API con su propio error si la acción no encaja (`session_
 * already_closed`, `session_not_started`...). "Entrar al aula" (Tarea 11 del
 * panel: aula del profesor) sigue el mismo criterio: se ofrece para
 * cualquier clase, presencial incluida — si no hay sala que abrir,
 * `/aula/:sessionId` lo dice con el error de la API (`room_not_ready`), no
 * ocultando el enlace de antemano.
 */
export function SessionMenuDialog({
  open,
  session,
  timeZone,
  locale,
  onClose,
  onChooseReschedule,
  onChooseCancel,
  onChooseAttendance,
}: SessionMenuDialogProps): ReactElement {
  const t = useT();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("calendar.sessionMenuTitle")}
      closeLabel={t("calendar.close")}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t("calendar.close")}
        </Button>
      }
    >
      <dl>
        <dt>{t("calendar.sessionMenuGroupLabel")}</dt>
        <dd>
          {session.groupName} ({session.courseCode})
        </dd>
        <dt>{t("calendar.sessionMenuTeacherLabel")}</dt>
        <dd>{session.teacherName ?? t("calendar.sessionMenuTeacherUnassigned")}</dd>
        <dt>{t("calendar.sessionMenuTimeLabel")}</dt>
        <dd>
          {formatDate(session.start, timeZone, locale)} – {formatDate(session.end, timeZone, locale, { timeStyle: "short" })}
        </dd>
        <dt>{t("calendar.sessionMenuStatusLabel")}</dt>
        <dd>{t(`calendar.status.${session.status}`)}</dd>
        <dt>{t("calendar.sessionMenuRoomLabel")}</dt>
        <dd>{session.roomProvider}</dd>
      </dl>
      <Button variant="secondary" onClick={onChooseReschedule}>
        {t("calendar.actionReschedule")}
      </Button>
      <Button variant="danger" onClick={onChooseCancel}>
        {t("calendar.actionCancel")}
      </Button>
      <Button variant="secondary" onClick={onChooseAttendance}>
        {t("calendar.actionAttendance")}
      </Button>
      <Link to="/aula/$sessionId" params={{ sessionId: session.sessionId }}>
        {t("calendar.actionJoinClassroom")}
      </Link>
    </Dialog>
  );
}
