import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useParams } from "@tanstack/react-router";
import { Button, Card } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { getExam, startExam, submitExam } from "./api.js";
import type { ExamDetail, ExamItemView } from "./types.js";

const CLOZE_TYPE = "cloze";
const WRITTEN_TYPES = new Set(["written_production", "spoken_production"]);
const CHOICE_TYPES = new Set(["multiple_choice", "reading_comprehension"]);

/** Minutos restantes hasta `deadlineAt`, sin bajar de 0. */
function minutesRemaining(deadlineAt: string | null, now: Date): number {
  if (!deadlineAt) return 0;
  const diffMs = new Date(deadlineAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / 60_000));
}

function ItemInput({
  item,
  value,
  onChange,
  writtenPlaceholder,
  spokenPlaceholder,
}: {
  item: ExamItemView;
  value: Record<string, unknown> | undefined;
  onChange: (response: Record<string, unknown>) => void;
  writtenPlaceholder: string;
  spokenPlaceholder: string;
}): ReactElement {
  if (CHOICE_TYPES.has(item.type)) {
    const options = (item.prompt["options"] as string[] | undefined) ?? [];
    const question = (item.prompt["question"] as string | undefined) ?? (item.prompt["passage"] as string | undefined) ?? "";
    return (
      <div>
        <p>{question}</p>
        {options.map((option, index) => (
          <label key={index} className="flex items-center gap-2">
            <input
              type="radio"
              name={item.id}
              checked={(value?.["correct"] as number | undefined) === index}
              onChange={() => onChange({ correct: index })}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (item.type === CLOZE_TYPE) {
    const blanks = (item.prompt["blanks"] as Array<{ id: number }> | undefined) ?? [];
    return (
      <div>
        <p>{item.prompt["text"] as string}</p>
        {blanks.map((blank) => (
          <input
            key={blank.id}
            type="text"
            value={(value?.[String(blank.id)] as string | undefined) ?? ""}
            onChange={(event) => onChange({ ...value, [String(blank.id)]: event.target.value })}
          />
        ))}
      </div>
    );
  }

  if (WRITTEN_TYPES.has(item.type)) {
    const placeholder = item.type === "spoken_production" ? spokenPlaceholder : writtenPlaceholder;
    return (
      <div>
        <p>{item.prompt["task"] as string}</p>
        <textarea
          value={(value?.["text"] as string | undefined) ?? ""}
          placeholder={placeholder}
          onChange={(event) => onChange({ text: event.target.value })}
          rows={6}
        />
      </div>
    );
  }

  return <p>{JSON.stringify(item.prompt)}</p>;
}

/**
 * El alumno hace el examen (Tarea 15 de la ola 2, Paso 6: «hacerlo con
 * cronómetro»). `Exam.deadlineAt` (servidor) es la fuente de verdad del
 * tiempo restante; este componente solo lo cuenta hacia atrás cada segundo
 * para pintarlo — nunca decide por su cuenta si el examen «se ha acabado»,
 * eso lo comprobaría `submit()` en el servidor si algún día se hiciera
 * cumplir de forma dura.
 */
export function TakeExamScreen(): ReactElement {
  const { examId } = useParams({ strict: false }) as { examId?: string };
  const t = useT();
  const describeError = useErrorMessage();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({});
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    getExam(examId).then(setExam).catch(() => setExam(null));
  }, [examId]);

  useEffect(() => {
    if (exam?.status !== "in_progress") return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [exam?.status]);

  const remainingMinutes = useMemo(() => minutesRemaining(exam?.deadlineAt ?? null, now), [exam?.deadlineAt, now]);

  if (!examId || !exam) {
    return <p role="status">{t("common.loading")}</p>;
  }

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await startExam(examId);
      setExam({ ...exam, status: result.status, deadlineAt: result.deadlineAt });
    } catch (err) {
      setError(err instanceof ApiError ? describeError(err.problem) : t("exams.take.genericError"));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await submitExam(examId, responses);
      setExam({ ...exam, status: result.status });
    } catch (err) {
      setError(err instanceof ApiError ? describeError(err.problem) : t("exams.take.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h1>{exam.title}</h1>
      {exam.status === "scheduled" && (
        <Button onClick={() => void handleStart()} isLoading={busy}>
          {busy ? t("exams.take.starting") : t("exams.take.start")}
        </Button>
      )}

      {exam.status === "in_progress" && (
        <>
          <p role="status">
            {remainingMinutes > 0 ? t("exams.take.remaining", { minutes: remainingMinutes }) : t("exams.take.timeUp")}
          </p>
          {exam.sections.map((section) => (
            <section key={section.skill}>
              <h2>{section.skill}</h2>
              {section.items.map((item) => (
                <ItemInput
                  key={item.id}
                  item={item}
                  value={responses[item.id]}
                  onChange={(response) => setResponses((prev) => ({ ...prev, [item.id]: response }))}
                  writtenPlaceholder={t("exams.take.writtenPlaceholder")}
                  spokenPlaceholder={t("exams.take.spokenPlaceholder")}
                />
              ))}
            </section>
          ))}
          {error && <p role="alert">{error}</p>}
          <Button onClick={() => void handleSubmit()} isLoading={busy}>
            {busy ? t("exams.take.submitting") : t("exams.take.submit")}
          </Button>
        </>
      )}

      {(exam.status === "submitted" || exam.status === "ai_graded" || exam.status === "teacher_validated") && (
        <p role="status">{t("exams.take.submitted")}</p>
      )}
    </Card>
  );
}
