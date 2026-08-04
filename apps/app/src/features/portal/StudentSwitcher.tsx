import type { ReactElement } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Select } from "../../ui/index.js";
import { useT } from "../../i18n/translate.js";
import type { PortalStudentOption } from "./types.js";

/**
 * Alumno elegido en las tres pantallas del portal (Paso 2 del brief: «un
 * tutor con dos hijos ve a los dos y cambia entre ellos»), como parámetro de
 * búsqueda de la URL (`?studentId=`) en vez de estado de componente: así
 * cada pantalla (`/mi/clases`, `/mi/facturas`, `/mi/asistencia`) recuerda la
 * elección al navegar entre ellas, es compartible con un enlace y sobrevive
 * a recargar la página — nada de esto es una decisión de negocio, es dónde
 * vive la preferencia de qué mirar.
 *
 * Sin `studentId` en la URL, las tres pantallas piden sin parámetro y la API
 * resuelve al alumno propio de la membresía (ella misma, o su primer
 * tutelado): no hace falta escribir un valor por defecto en la URL para que
 * eso funcione.
 */
export function usePortalStudentId(): {
  studentId: string | undefined;
  setStudentId: (studentId: string) => void;
} {
  const search = useSearch({ strict: false }) as { studentId?: string };
  const navigate = useNavigate();

  return {
    studentId: search.studentId,
    setStudentId: (studentId: string) => {
      void navigate({
        to: ".",
        search: (prev) => ({ ...(prev as Record<string, unknown>), studentId }),
        replace: true,
      });
    },
  };
}

export interface StudentSwitcherProps {
  students: PortalStudentOption[];
  value: string | undefined;
  onChange: (studentId: string) => void;
}

/**
 * Nada que pintar con un solo alumno (el caso normal: un alumno viendo lo
 * suyo, o un tutor con un único hijo) — el selector solo aparece cuando de
 * verdad hay algo entre lo que elegir.
 */
export function StudentSwitcher({ students, value, onChange }: StudentSwitcherProps): ReactElement | null {
  const t = useT();
  if (students.length <= 1) return null;

  const selected = value && students.some((s) => s.studentId === value) ? value : students[0]!.studentId;

  return (
    <Select
      label={t("portal.switchStudentLabel")}
      value={selected}
      onChange={(event) => onChange(event.target.value)}
      options={students.map((student) => ({ value: student.studentId, label: student.name }))}
    />
  );
}
