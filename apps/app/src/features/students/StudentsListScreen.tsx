import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, EmptyState, ErrorState, Input, Select, Table, Tag } from "../../ui/index.js";
import type { TableColumn, TagVariant } from "../../ui/index.js";
import { useT } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useLocale } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { listStudents } from "./api.js";
import { formatStudentDate } from "./format.js";
import type { CefrLevel, StudentListItem, StudentStatus } from "./types.js";

export const STUDENTS_QUERY_KEY = ["students", "list"] as const;

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const STATUSES: StudentStatus[] = ["active", "paused", "left"];
const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<StudentStatus, TagVariant> = {
  active: "success",
  paused: "warning",
  left: "neutral",
};

function matches(student: StudentListItem, search: string): boolean {
  if (!search) return true;
  const needle = search.trim().toLowerCase();
  return student.name.toLowerCase().includes(needle) || student.email.toLowerCase().includes(needle);
}

/**
 * Listado de alumnado (Tarea 7, Paso 3).
 *
 * Búsqueda, filtro por nivel y estado, y paginación: los tres son
 * presentación sobre una lista que la API ya entrega completa y autorizada
 * por RLS (`GET /students` no acepta parámetros de consulta) — no es una
 * regla de negocio que pudiera decidirse distinto en cliente y servidor, así
 * que resolverlos aquí no infringe "cero lógica de negocio en el frontend".
 */
export function StudentsListScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);

  const query = useQuery({ queryKey: STUDENTS_QUERY_KEY, queryFn: listStudents });

  const filtered = useMemo(() => {
    const all = query.data ?? [];
    return all.filter(
      (student) =>
        matches(student, search) &&
        (level === "" || student.currentLevel === level) &&
        (status === "" || student.status === status),
    );
  }, [query.data, search, level, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const resetToFirstPage = (): void => setPage(0);

  const columns: TableColumn<StudentListItem>[] = [
    {
      key: "name",
      header: t("students.list.columnName"),
      render: (row) => (
        <Link to="/alumnos/$studentId" params={{ studentId: row.studentId }}>
          {row.name}
        </Link>
      ),
    },
    { key: "email", header: t("students.list.columnEmail"), render: (row) => row.email },
    {
      key: "level",
      header: t("students.list.columnLevel"),
      render: (row) => row.currentLevel ?? "—",
    },
    {
      key: "status",
      header: t("students.list.columnStatus"),
      render: (row) => <Tag variant={STATUS_VARIANT[row.status]}>{t(`students.status.${row.status}`)}</Tag>,
    },
    {
      key: "guardian",
      header: t("students.list.columnGuardian"),
      render: (row) => (row.guardianRequired ? <Tag variant="warning">{t("students.list.guardianRequired")}</Tag> : "—"),
    },
    {
      key: "joinedAt",
      header: t("students.list.columnJoinedAt"),
      numeric: true,
      render: (row) => formatStudentDate(row.joinedAt, locale, { dateStyle: "medium" }),
    },
  ];

  const errorTitle =
    query.error instanceof ApiError ? errorMessage(query.error.problem) : t("students.list.errorTitle");

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold">{t("students.title")}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void navigate({ to: "/alumnos/importar" })}>
            {t("students.importCsv")}
          </Button>
          <Button onClick={() => void navigate({ to: "/alumnos/nuevo" })}>{t("students.newStudent")}</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <Input
          label={t("students.list.searchLabel")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetToFirstPage();
          }}
        />
        <Select
          label={t("students.list.levelLabel")}
          value={level}
          onChange={(event) => {
            setLevel(event.target.value);
            resetToFirstPage();
          }}
          options={LEVELS.map((value) => ({ value, label: value }))}
          placeholder={t("students.list.levelAll")}
        />
        <Select
          label={t("students.list.statusLabel")}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetToFirstPage();
          }}
          options={STATUSES.map((value) => ({ value, label: t(`students.status.${value}`) }))}
          placeholder={t("students.list.statusAll")}
        />
      </div>

      <Table
        columns={columns}
        rows={pageRows}
        getRowKey={(row) => row.studentId}
        caption={t("students.list.caption")}
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
              title={t("students.list.emptyTitle")}
              description={t("students.list.emptyDescription")}
              action={<Button onClick={() => void navigate({ to: "/alumnos/nuevo" })}>{t("students.newStudent")}</Button>}
            />
          ) : (
            <EmptyState
              title={t("students.list.noResultsTitle")}
              description={t("students.list.noResultsDescription")}
            />
          )
        }
      />

      {!query.isPending && !query.isError && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span>{t("students.list.pageIndicator", { page: currentPage + 1, totalPages })}</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t("students.list.previousPage")}
            </Button>
            <Button
              variant="secondary"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              {t("students.list.nextPage")}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
