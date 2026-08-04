import { useState } from "react";
import type { ReactElement } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { Button, EmptyState, ErrorState, Input, Selector, Skeleton, Table, Chip, useToast } from "@langopia/ui";
import type { TableColumn, ChipVariant } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { getGroupRoster } from "../calendar/api.js";
import { listStudents } from "../students/api.js";
import { enrolStudentInGroup, getGroup } from "./api.js";
import { formatDateOnly } from "./format.js";
import type { GroupDetail, GroupStatus } from "./types.js";

const GROUP_STATUS_VARIANT: Record<GroupStatus, ChipVariant> = {
  planned: "neutral",
  running: "success",
  finished: "neutral",
  canceled: "critical",
};

type EnrolFormValues = { studentId: string; agreedPriceCents: string };

/**
 * Ficha de un grupo (Tarea 8, Paso 3): curso, profesor, capacidad y fechas,
 * el padrón de alumnos matriculados —`GET /scheduling/groups/:id/roster`,
 * Tarea 9, reutilizado tal cual en vez de duplicar la misma consulta en
 * `catalog`— y la matriculación, con aviso en cuanto se alcanza la
 * capacidad. El aviso compara dos números que la API ya entrega
 * (`capacity` de esta ficha, el tamaño del padrón); no decide nada que la
 * API no fuera a rechazar igualmente si la petición llegara a intentarse
 * (`group_full`).
 */
export function GroupDetailScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { groupId } = useParams({ strict: false }) as { groupId?: string };

  const groupQuery = useQuery({
    queryKey: ["groups", "detail", groupId] as const,
    queryFn: () => getGroup(groupId!),
    enabled: Boolean(groupId),
  });

  if (groupQuery.isPending) {
    return (
      <main className="p-6">
        <Skeleton variant="text" lines={4} />
      </main>
    );
  }

  if (groupQuery.isError) {
    const problem = groupQuery.error instanceof ApiError ? groupQuery.error.problem : null;
    const notFound = problem?.code === "not_found";
    return (
      <main className="p-6">
        <ErrorState
          title={notFound ? t("courses.groupDetail.notFoundTitle") : problem ? errorMessage(problem) : t("courses.groupDetail.errorTitle")}
          action={notFound ? undefined : <Button onClick={() => void groupQuery.refetch()}>{t("common.retry")}</Button>}
        />
      </main>
    );
  }

  return <GroupDetailContent groupId={groupId!} group={groupQuery.data} />;
}

function GroupDetailContent({ groupId, group }: { groupId: string; group: GroupDetail }): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [enrolError, setEnrolError] = useState<string | null>(null);

  const rosterQuery = useQuery({
    queryKey: ["calendar", "group-roster", groupId] as const,
    queryFn: () => getGroupRoster(groupId),
  });
  const studentsQuery = useQuery({ queryKey: ["students", "list"] as const, queryFn: listStudents });

  const roster = rosterQuery.data ?? [];
  const isFull = roster.length >= group.capacity;
  const enrolledIds = new Set(roster.map((member) => member.studentId));
  const availableStudents = (studentsQuery.data ?? []).filter(
    (student) => student.status === "active" && !enrolledIds.has(student.studentId),
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<EnrolFormValues>({ defaultValues: { studentId: "", agreedPriceCents: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setEnrolError(null);
    try {
      await enrolStudentInGroup(groupId, {
        studentId: values.studentId,
        agreedPriceCents: values.agreedPriceCents === "" ? null : Number(values.agreedPriceCents),
      });
      reset();
      showToast({ variant: "success", title: t("courses.groupDetail.enrolSuccess") });
      await queryClient.invalidateQueries({ queryKey: ["calendar", "group-roster", groupId] });
    } catch (error) {
      setEnrolError(
        error instanceof ApiError ? errorMessage(error.problem) : t("courses.groupDetail.enrolGenericError"),
      );
    }
  });

  const columns: TableColumn<{ studentId: string; name: string }>[] = [
    { key: "name", header: t("courses.groupDetail.columnStudentName"), render: (row) => row.name },
  ];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-1">{group.name}</h1>
      <p className="text-muted mb-4">{group.courseCode}</p>

      <dl className="grid grid-cols-2 gap-2 mb-6 max-w-md">
        <dt className="text-muted">{t("courses.groupDetail.teacherLabel")}</dt>
        <dd>{group.teacherName ?? t("courses.groupDetail.teacherUnassigned")}</dd>
        <dt className="text-muted">{t("courses.groupDetail.statusLabel")}</dt>
        <dd>
          <Chip variant={GROUP_STATUS_VARIANT[group.status]}>{t(`courses.groupStatus.${group.status}`)}</Chip>
        </dd>
        <dt className="text-muted">{t("courses.groupDetail.startsOnLabel")}</dt>
        <dd>{formatDateOnly(group.startsOn, locale)}</dd>
        <dt className="text-muted">{t("courses.groupDetail.endsOnLabel")}</dt>
        <dd>{group.endsOn ? formatDateOnly(group.endsOn, locale) : t("courses.groupDetail.endsOnOpen")}</dd>
        <dt className="text-muted">{t("courses.groupDetail.capacityLabel")}</dt>
        <dd>
          {t("courses.groupDetail.capacityValue", { enrolled: roster.length, capacity: group.capacity })}{" "}
          {isFull && <Chip variant="warning">{t("courses.groupDetail.capacityFull")}</Chip>}
        </dd>
      </dl>

      <h2 className="text-xl font-semibold mb-2">{t("courses.groupDetail.rosterTitle")}</h2>
      <Table
        columns={columns}
        rows={roster}
        getRowKey={(row) => row.studentId}
        caption={t("courses.groupDetail.rosterCaption")}
        captionVisuallyHidden
        isLoading={rosterQuery.isPending}
        error={rosterQuery.isError ? <ErrorState title={t("courses.groupDetail.rosterErrorTitle")} /> : undefined}
        emptyState={<EmptyState title={t("courses.groupDetail.rosterEmptyTitle")} />}
      />

      <h2 className="text-xl font-semibold mt-6 mb-2">{t("courses.groupDetail.enrolTitle")}</h2>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4 max-w-sm">
        <Selector
          label={t("courses.groupDetail.studentLabel")}
          required
          isLoading={studentsQuery.isPending}
          placeholder={t("courses.groupDetail.studentPlaceholder")}
          hint={availableStudents.length === 0 ? t("courses.groupDetail.studentsEmptyHint") : undefined}
          error={errors.studentId?.message}
          options={availableStudents.map((student) => ({ value: student.studentId, label: student.name }))}
          {...register("studentId", { required: t("courses.groupDetail.studentRequired") })}
        />
        <Input
          label={t("courses.groupDetail.agreedPriceLabel")}
          hint={t("courses.groupDetail.agreedPriceHint")}
          type="number"
          min={0}
          {...register("agreedPriceCents")}
        />
        {enrolError && <p role="alert">{enrolError}</p>}
        <Button type="submit" isLoading={isSubmitting} disabled={isFull || availableStudents.length === 0}>
          {isSubmitting ? t("courses.groupDetail.enrolSubmitting") : t("courses.groupDetail.enrolSubmit")}
        </Button>
      </form>
    </main>
  );
}
