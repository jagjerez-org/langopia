import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button, EmptyState, ErrorState, Input, Select, Table, Tag, useToast } from "../../ui/index.js";
import type { TableColumn, TagVariant } from "../../ui/index.js";
import { useT } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useLocale } from "../../i18n/translate.js";
import { formatMoney } from "../../i18n/format.js";
import { ApiError } from "../../lib/api-client.js";
import { listTeachers } from "./api.js";
import { HireTeacherDialog } from "./HireTeacherDialog.js";
import type { TeacherListItem, TeacherStatus, TeacherTier } from "./types.js";

export const TEACHERS_QUERY_KEY = ["teachers", "list"] as const;

const TIERS: TeacherTier[] = ["community", "professional", "specialist"];
const STATUSES: TeacherStatus[] = ["active", "on_leave", "left"];

const STATUS_VARIANT: Record<TeacherStatus, TagVariant> = {
  active: "success",
  on_leave: "warning",
  left: "neutral",
};

function matches(teacher: TeacherListItem, search: string): boolean {
  if (!search) return true;
  const needle = search.trim().toLowerCase();
  return teacher.name.toLowerCase().includes(needle) || teacher.email.toLowerCase().includes(needle);
}

/**
 * Listado de profesorado (Tarea 8, Paso 1). Igual patrón que
 * `StudentsListScreen` (Tarea 7): la lista completa que entrega `GET
 * /teachers` (añadido por esta tarea) ya viene autorizada por RLS —si la
 * misma persona da clase en dos escuelas, esta consulta solo ve la fila de
 * la escuela activa (comprobado en vivo, ver el informe)—, y aquí solo se
 * filtra en cliente sobre lo que ya llegó completo. Sin paginación: el
 * profesorado de una escuela son unas pocas decenas, como mucho, no miles.
 */
export function TeachersListScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("");
  const [hireOpen, setHireOpen] = useState(false);

  const query = useQuery({ queryKey: TEACHERS_QUERY_KEY, queryFn: listTeachers });

  const filtered = useMemo(() => {
    const all = query.data ?? [];
    return all.filter(
      (teacher) =>
        matches(teacher, search) &&
        (tier === "" || teacher.tier === tier) &&
        (status === "" || teacher.status === status),
    );
  }, [query.data, search, tier, status]);

  const columns: TableColumn<TeacherListItem>[] = [
    {
      key: "name",
      header: t("teachers.list.columnName"),
      render: (row) => (
        <Link to="/profesores/$teacherId" params={{ teacherId: row.teacherId }}>
          {row.name}
        </Link>
      ),
    },
    { key: "email", header: t("teachers.list.columnEmail"), render: (row) => row.email },
    {
      key: "tier",
      header: t("teachers.list.columnTier"),
      render: (row) => t(`teachers.tier.${row.tier}`),
    },
    {
      key: "rate",
      header: t("teachers.list.columnRate"),
      numeric: true,
      render: (row) => formatMoney(row.hourlyRateCents, row.currency, locale),
    },
    {
      key: "hours",
      header: t("teachers.list.columnHours"),
      numeric: true,
      render: (row) => String(row.contractedHoursWeek),
    },
    {
      key: "status",
      header: t("teachers.list.columnStatus"),
      render: (row) => <Tag variant={STATUS_VARIANT[row.status]}>{t(`teachers.status.${row.status}`)}</Tag>,
    },
    {
      key: "languages",
      header: t("teachers.list.columnLanguages"),
      render: (row) => (row.languages.length > 0 ? row.languages.join(", ") : "—"),
    },
  ];

  const errorTitle =
    query.error instanceof ApiError ? errorMessage(query.error.problem) : t("teachers.list.errorTitle");

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold">{t("teachers.title")}</h1>
        <Button onClick={() => setHireOpen(true)}>{t("teachers.newTeacher")}</Button>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <Input
          label={t("teachers.list.searchLabel")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          label={t("teachers.list.tierLabel")}
          value={tier}
          onChange={(event) => setTier(event.target.value)}
          options={TIERS.map((value) => ({ value, label: t(`teachers.tier.${value}`) }))}
          placeholder={t("teachers.list.tierAll")}
        />
        <Select
          label={t("teachers.list.statusLabel")}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={STATUSES.map((value) => ({ value, label: t(`teachers.status.${value}`) }))}
          placeholder={t("teachers.list.statusAll")}
        />
      </div>

      <Table
        columns={columns}
        rows={filtered}
        getRowKey={(row) => row.teacherId}
        caption={t("teachers.list.caption")}
        captionVisuallyHidden
        isLoading={query.isPending}
        error={
          query.isError ? (
            <ErrorState title={errorTitle} action={<Button onClick={() => void query.refetch()}>{t("common.retry")}</Button>} />
          ) : undefined
        }
        emptyState={
          (query.data ?? []).length === 0 ? (
            <EmptyState
              title={t("teachers.list.emptyTitle")}
              description={t("teachers.list.emptyDescription")}
              action={<Button onClick={() => setHireOpen(true)}>{t("teachers.newTeacher")}</Button>}
            />
          ) : (
            <EmptyState
              title={t("teachers.list.noResultsTitle")}
              description={t("teachers.list.noResultsDescription")}
            />
          )
        }
      />

      <HireTeacherDialog
        open={hireOpen}
        onClose={() => setHireOpen(false)}
        onHired={() => {
          setHireOpen(false);
          showToast({ variant: "success", title: t("teachers.create.success") });
          void queryClient.invalidateQueries({ queryKey: TEACHERS_QUERY_KEY });
        }}
      />
    </main>
  );
}
