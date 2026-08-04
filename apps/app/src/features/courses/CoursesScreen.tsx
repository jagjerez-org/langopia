import { useState } from "react";
import type { ReactElement } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button, Panel, EmptyState, ErrorState, Skeleton, Table, Chip, useToast } from "@langopia/ui";
import type { TableColumn, ChipVariant } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { formatMoney } from "../../i18n/format.js";
import { ApiError } from "../../lib/api-client.js";
import { listTeachers } from "../teachers/api.js";
import { CreateCourseDialog } from "./CreateCourseDialog.js";
import { CreateGroupDialog } from "./CreateGroupDialog.js";
import { getSchoolLocales, listCourses } from "./api.js";
import { formatDateOnly, resolveCourseTranslation } from "./format.js";
import type { CourseGroupSummary, CourseListItem, GroupStatus } from "./types.js";

export const COURSES_QUERY_KEY = ["courses", "list"] as const;
const SCHOOL_LOCALES_QUERY_KEY = ["courses", "school-locales"] as const;

const GROUP_STATUS_VARIANT: Record<GroupStatus, ChipVariant> = {
  planned: "neutral",
  running: "success",
  finished: "neutral",
  canceled: "critical",
};

/**
 * Cursos y grupos (Tarea 8, Pasos 2 y 3): `/cursos` lista el catálogo con sus
 * grupos anidados —no hay una ruta `/cursos/:id` en el brief, así que el
 * detalle de cada curso se pinta aquí mismo—, con el alta de curso y de
 * grupo en diálogos. Cada fila de grupo enlaza a `/grupos/:id`, la única
 * ficha propia de esta tarea.
 */
export function CoursesScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [groupDialogCourse, setGroupDialogCourse] = useState<CourseListItem | null>(null);

  const coursesQuery = useQuery({ queryKey: COURSES_QUERY_KEY, queryFn: listCourses });
  const localesQuery = useQuery({ queryKey: SCHOOL_LOCALES_QUERY_KEY, queryFn: getSchoolLocales });
  const teachersQuery = useQuery({ queryKey: ["teachers", "list"], queryFn: listTeachers });

  const teacherOptions = (teachersQuery.data ?? []).map((teacher) => ({
    teacherId: teacher.teacherId,
    name: teacher.name,
  }));

  function refreshCourses(): void {
    void queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
  }

  if (coursesQuery.isPending) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold mb-4">{t("courses.title")}</h1>
        <Skeleton variant="rect" height="md" />
      </main>
    );
  }

  if (coursesQuery.isError) {
    const title =
      coursesQuery.error instanceof ApiError ? errorMessage(coursesQuery.error.problem) : t("courses.list.errorTitle");
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold mb-4">{t("courses.title")}</h1>
        <ErrorState title={title} action={<Button onClick={() => void coursesQuery.refetch()}>{t("common.retry")}</Button>} />
      </main>
    );
  }

  const courses = coursesQuery.data ?? [];
  const schoolDefaultLocale = localesQuery.data?.defaultLocale ?? locale;

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold">{t("courses.title")}</h1>
        <Button onClick={() => setCreateCourseOpen(true)} disabled={!localesQuery.data}>
          {t("courses.newCourse")}
        </Button>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          title={t("courses.list.emptyTitle")}
          description={t("courses.list.emptyDescription")}
          action={
            <Button onClick={() => setCreateCourseOpen(true)} disabled={!localesQuery.data}>
              {t("courses.newCourse")}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.courseId}
              course={course}
              schoolDefaultLocale={schoolDefaultLocale}
              onNewGroup={() => setGroupDialogCourse(course)}
            />
          ))}
        </div>
      )}

      {localesQuery.data && (
        <CreateCourseDialog
          open={createCourseOpen}
          onClose={() => setCreateCourseOpen(false)}
          supportedLocales={localesQuery.data.supportedLocales}
          defaultLocale={localesQuery.data.defaultLocale}
          onCreated={() => {
            refreshCourses();
            showToast({ variant: "success", title: t("courses.create.success") });
            setCreateCourseOpen(false);
          }}
        />
      )}

      {groupDialogCourse && (
        <CreateGroupDialog
          open
          onClose={() => setGroupDialogCourse(null)}
          courseId={groupDialogCourse.courseId}
          courseLabel={resolveCourseTranslation(groupDialogCourse.translations, locale, schoolDefaultLocale)?.name ?? groupDialogCourse.code}
          teachers={teacherOptions}
          onCreated={() => {
            refreshCourses();
            showToast({ variant: "success", title: t("courses.groupCreate.success") });
            setGroupDialogCourse(null);
          }}
        />
      )}
    </main>
  );
}

function CourseCard({
  course,
  schoolDefaultLocale,
  onNewGroup,
}: {
  course: CourseListItem;
  schoolDefaultLocale: string;
  onNewGroup: () => void;
}): ReactElement {
  const t = useT();
  const locale = useLocale();
  const translation = resolveCourseTranslation(course.translations, locale, schoolDefaultLocale);

  const columns: TableColumn<CourseGroupSummary>[] = [
    {
      key: "name",
      header: t("courses.list.columnGroupName"),
      render: (group) => (
        <Link to="/grupos/$groupId" params={{ groupId: group.groupId }}>
          {group.name}
        </Link>
      ),
    },
    {
      key: "teacher",
      header: t("courses.list.columnGroupTeacher"),
      render: (group) => group.teacherName ?? t("courses.list.teacherUnassigned"),
    },
    {
      key: "capacity",
      header: t("courses.list.columnGroupCapacity"),
      numeric: true,
      render: (group) => String(group.capacity),
    },
    {
      key: "status",
      header: t("courses.list.columnGroupStatus"),
      render: (group) => <Chip variant={GROUP_STATUS_VARIANT[group.status]}>{t(`courses.groupStatus.${group.status}`)}</Chip>,
    },
    {
      key: "dates",
      header: t("courses.list.columnGroupDates"),
      render: (group) =>
        group.endsOn
          ? t("courses.list.datesRange", {
              start: formatDateOnly(group.startsOn, locale),
              end: formatDateOnly(group.endsOn, locale),
            })
          : t("courses.list.datesOpenEnded", { start: formatDateOnly(group.startsOn, locale) }),
    },
  ];

  return (
    <Panel
      title={`${course.code} — ${translation?.name ?? course.code}`}
      actions={
        <Button variant="secondary" size="sm" onClick={onNewGroup}>
          {t("courses.newGroup")}
        </Button>
      }
    >
      <dl className="grid grid-cols-4 gap-2 mb-4 text-sm">
        <dt className="text-muted">{t("courses.list.columnLanguage")}</dt>
        <dd>{course.language}</dd>
        <dt className="text-muted">{t("courses.list.columnLevel")}</dt>
        <dd>{course.level}</dd>
        <dt className="text-muted">{t("courses.list.columnModality")}</dt>
        <dd>{t(`courses.modality.${course.modality}`)}</dd>
        <dt className="text-muted">{t("courses.list.columnSessions")}</dt>
        <dd>{course.totalSessions}</dd>
        <dt className="text-muted">{t("courses.list.columnPrice")}</dt>
        <dd>{formatMoney(course.priceCents, course.currency, locale)}</dd>
        <dt className="text-muted">{t("courses.list.columnActive")}</dt>
        <dd>{course.isActive ? t("courses.list.activeYes") : t("courses.list.activeNo")}</dd>
      </dl>

      <Table
        columns={columns}
        rows={course.groups}
        getRowKey={(group) => group.groupId}
        caption={t("courses.list.groupsCaption", { course: course.code })}
        captionVisuallyHidden
        emptyState={<EmptyState title={t("courses.list.groupsEmpty")} />}
      />
    </Panel>
  );
}
