import { useState } from "react";
import type { ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { Button, Card, Dialog, ErrorState, Input, Select, Skeleton, Tag, useToast } from "../../ui/index.js";
import { useT, useLocale } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatMoney } from "../../i18n/format.js";
import { ApiError } from "../../lib/api-client.js";
import { listTeachers, releaseTeacher, setTeacherAvailability, updateTeacher } from "./api.js";
import { AvailabilityGrid } from "./AvailabilityGrid.js";
import { cellsFromSlots, slotsFromCells } from "./availability-grid.js";
import { formatDateOnly } from "./format.js";
import { TEACHERS_QUERY_KEY } from "./TeachersListScreen.js";
import { Tabs } from "../students/Tabs.js";
import type { TeacherListItem, TeacherTier } from "./types.js";

const TIERS: TeacherTier[] = ["community", "professional", "specialist"];

/**
 * Ficha de profesor (Tarea 8, Paso 1), con tarifa, disponibilidad y baja.
 *
 * Igual patrón que `StudentDetailScreen` (Tarea 7): `GET /teachers` no tiene
 * ruta de detalle propia, así que la ficha reutiliza la misma fila que ya
 * pinta `TeachersListScreen`, cacheada por TanStack Query con la misma
 * clave — no hay una segunda llamada si ya se navegó desde ahí.
 */
export function TeacherDetailScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { teacherId } = useParams({ strict: false }) as { teacherId?: string };

  const listQuery = useQuery({ queryKey: TEACHERS_QUERY_KEY, queryFn: listTeachers });
  const teacher = listQuery.data?.find((tr) => tr.teacherId === teacherId);

  if (listQuery.isPending) {
    return (
      <main className="p-6">
        <Skeleton variant="text" lines={4} />
      </main>
    );
  }

  if (listQuery.isError) {
    const problem = listQuery.error instanceof ApiError ? listQuery.error.problem : null;
    return (
      <main className="p-6">
        <ErrorState
          title={problem ? errorMessage(problem) : t("teachers.list.errorTitle")}
          action={<Button onClick={() => void listQuery.refetch()}>{t("common.retry")}</Button>}
        />
      </main>
    );
  }

  if (!teacher) {
    return (
      <main className="p-6">
        <ErrorState title={t("teachers.detail.notFoundTitle")} />
      </main>
    );
  }

  return <TeacherDetailContent teacher={teacher} />;
}

function TeacherDetailContent({ teacher }: { teacher: TeacherListItem }): ReactElement {
  const t = useT();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-1">{teacher.name}</h1>
      <p className="text-muted mb-4">{teacher.email}</p>

      <Tabs
        label={t("teachers.title")}
        tabs={[
          { id: "data", label: t("teachers.detail.tabData"), content: <DataTab teacher={teacher} /> },
          {
            id: "availability",
            label: t("teachers.detail.tabAvailability"),
            content: <AvailabilityTab teacher={teacher} />,
          },
        ]}
      />
    </main>
  );
}

/* ─── Pestaña «Datos» ───────────────────────────────────────────────────── */

type EditFormValues = { tier: TeacherTier; hourlyRateCents: string };
type ReleaseFormValues = { reason: string };

function DataTab({ teacher }: { teacher: TeacherListItem }): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [editError, setEditError] = useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const editForm = useForm<EditFormValues>({
    defaultValues: { tier: teacher.tier, hourlyRateCents: String(teacher.hourlyRateCents) },
  });
  const releaseForm = useForm<ReleaseFormValues>({ defaultValues: { reason: "" } });

  const editMutation = useMutation({
    mutationFn: (values: EditFormValues) =>
      updateTeacher(teacher.teacherId, { tier: values.tier, hourlyRateCents: Number(values.hourlyRateCents) }),
    onSuccess: async () => {
      showToast({ variant: "success", title: t("teachers.detail.editSuccess") });
      await queryClient.invalidateQueries({ queryKey: TEACHERS_QUERY_KEY });
    },
    onError: (error) => {
      setEditError(error instanceof ApiError ? errorMessage(error.problem) : t("teachers.detail.editError"));
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (values: ReleaseFormValues) => releaseTeacher(teacher.teacherId, values.reason),
    onSuccess: async () => {
      showToast({ variant: "success", title: t("teachers.detail.releaseSuccess") });
      setReleaseOpen(false);
      await queryClient.invalidateQueries({ queryKey: TEACHERS_QUERY_KEY });
    },
    onError: (error) => {
      setReleaseError(
        error instanceof ApiError ? errorMessage(error.problem) : t("teachers.detail.releaseError"),
      );
    },
  });

  const onSubmitEdit = editForm.handleSubmit((values) => {
    setEditError(null);
    editMutation.mutate(values);
  });
  const onSubmitRelease = releaseForm.handleSubmit((values) => {
    setReleaseError(null);
    releaseMutation.mutate(values);
  });

  return (
    <div className="flex flex-col gap-6">
      <Card title={t("teachers.detail.profileTitle")}>
        <dl className="grid grid-cols-2 gap-2 mb-4">
          <dt className="text-muted">{t("teachers.detail.tierLabel")}</dt>
          <dd>{t(`teachers.tier.${teacher.tier}`)}</dd>
          <dt className="text-muted">{t("teachers.detail.hourlyRateLabel")}</dt>
          <dd>{formatMoney(teacher.hourlyRateCents, teacher.currency, locale)}</dd>
          <dt className="text-muted">{t("teachers.detail.hiredAtLabel")}</dt>
          <dd>{formatDateOnly(teacher.hiredAt, locale)}</dd>
          <dt className="text-muted">{t("teachers.detail.contractedHoursLabel")}</dt>
          <dd>{teacher.contractedHoursWeek}</dd>
          <dt className="text-muted">{t("teachers.detail.statusLabel")}</dt>
          <dd>
            <Tag variant={teacher.status === "active" ? "success" : teacher.status === "on_leave" ? "warning" : "neutral"}>
              {t(`teachers.status.${teacher.status}`)}
            </Tag>
          </dd>
          <dt className="text-muted">{t("teachers.detail.languagesLabel")}</dt>
          <dd>{teacher.languages.length > 0 ? teacher.languages.join(", ") : "—"}</dd>
          <dt className="text-muted">{t("teachers.detail.certificationsLabel")}</dt>
          <dd>{teacher.certifications.length > 0 ? teacher.certifications.join(", ") : "—"}</dd>
          <dt className="text-muted">{t("teachers.detail.isNativeSpeakerLabel")}</dt>
          <dd>{teacher.isNativeSpeaker ? t("teachers.detail.isNativeSpeakerYes") : t("teachers.detail.isNativeSpeakerNo")}</dd>
          {teacher.bio && (
            <>
              <dt className="text-muted">{t("teachers.detail.bioLabel")}</dt>
              <dd>{teacher.bio}</dd>
            </>
          )}
          {teacher.status === "left" && teacher.leftReason && (
            <>
              <dt className="text-muted">{t("teachers.detail.leftReasonLabel")}</dt>
              <dd>{teacher.leftReason}</dd>
            </>
          )}
        </dl>

        <form onSubmit={(event) => void onSubmitEdit(event)} noValidate className="flex flex-col gap-4 max-w-sm">
          <Select
            label={t("teachers.detail.tierLabel")}
            options={TIERS.map((value) => ({ value, label: t(`teachers.tier.${value}`) }))}
            {...editForm.register("tier")}
          />
          <Input
            label={t("teachers.detail.hourlyRateLabel")}
            hint={t("teachers.detail.hourlyRateHint")}
            type="number"
            min={1}
            step={1}
            {...editForm.register("hourlyRateCents", { required: true, min: 1 })}
          />
          {editError && <p role="alert">{editError}</p>}
          <Button type="submit" isLoading={editMutation.isPending}>
            {editMutation.isPending ? t("teachers.detail.editSubmitting") : t("teachers.detail.editSubmit")}
          </Button>
        </form>
      </Card>

      {teacher.status !== "left" && (
        <div>
          <Button variant="danger" onClick={() => setReleaseOpen(true)}>
            {t("teachers.detail.releaseAction")}
          </Button>
          <Dialog
            open={releaseOpen}
            onClose={() => setReleaseOpen(false)}
            title={t("teachers.detail.releaseDialogTitle", { name: teacher.name })}
            description={t("teachers.detail.releaseDialogDescription")}
            closeLabel={t("teachers.detail.closeDialog")}
            footer={
              <>
                <Button variant="secondary" onClick={() => setReleaseOpen(false)}>
                  {t("teachers.detail.releaseCancel")}
                </Button>
                <Button variant="danger" isLoading={releaseMutation.isPending} onClick={() => void onSubmitRelease()}>
                  {t("teachers.detail.releaseConfirm")}
                </Button>
              </>
            }
          >
            <Input
              label={t("teachers.detail.releaseReasonLabel")}
              required
              error={releaseForm.formState.errors.reason?.message}
              {...releaseForm.register("reason", { required: t("teachers.detail.releaseReasonRequired") })}
            />
            {releaseError && <p role="alert">{releaseError}</p>}
          </Dialog>
        </div>
      )}
    </div>
  );
}

/* ─── Pestaña «Disponibilidad» ──────────────────────────────────────────── */

function AvailabilityTab({ teacher }: { teacher: TeacherListItem }): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [cells, setCells] = useState(() => cellsFromSlots(teacher.availability));
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => setTeacherAvailability(teacher.teacherId, { slots: slotsFromCells(cells) }),
    onSuccess: async () => {
      setSaveError(null);
      showToast({ variant: "success", title: t("teachers.availability.success") });
      await queryClient.invalidateQueries({ queryKey: TEACHERS_QUERY_KEY });
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiError ? errorMessage(error.problem) : t("teachers.availability.genericError"),
      );
    },
  });

  function toggle(weekday: number, hour: number): void {
    setCells((current) => {
      const key = `${weekday}-${hour}`;
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">{t("teachers.availability.hint")}</p>
      <AvailabilityGrid cells={cells} onToggle={toggle} disabled={saveMutation.isPending} />
      {saveError && <p role="alert">{saveError}</p>}
      <div>
        <Button onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
          {saveMutation.isPending ? t("teachers.availability.saving") : t("teachers.availability.save")}
        </Button>
      </div>
    </div>
  );
}
