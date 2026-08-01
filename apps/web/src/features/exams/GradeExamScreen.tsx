import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useParams } from "@tanstack/react-router";
import { Button, Card, Input } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { getExam, gradeExam, validateExam } from "./api.js";
import type { ExamDetail } from "./types.js";

/**
 * Corregir y firmar (Tarea 15 de la ola 2, Paso 6). La IA propone
 * (`gradeExam`, `exam.aiScore`/`exam.aiFeedback`); mientras el profesor no
 * firme (`validateExam`), `exam.countsForRecord` sigue en `false` — este
 * componente no lo oculta ni lo suaviza, lo muestra literal
 * (`countsForRecordNotice`) hasta que de verdad cambie.
 */
export function GradeExamScreen(): ReactElement {
  const { examId } = useParams({ strict: false }) as { examId?: string };
  const t = useT();
  const describeError = useErrorMessage();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [score, setScore] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!examId) return;
    const found = await getExam(examId);
    setExam(found);
    if (found.score !== null) setScore(String(found.score));
    else if (found.aiScore !== null) setScore(String(found.aiScore));
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  if (!examId || !exam) {
    return <p role="status">{t("common.loading")}</p>;
  }

  const handleGrade = async () => {
    setBusy(true);
    setError(null);
    try {
      await gradeExam(examId);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? describeError(err.problem) : t("exams.grade.genericError"));
    } finally {
      setBusy(false);
    }
  };

  const handleValidate = async () => {
    setBusy(true);
    setError(null);
    try {
      await validateExam(examId, Number(score));
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? describeError(err.problem) : t("exams.grade.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h1>{t("exams.grade.title")}</h1>
      <h2>{exam.title}</h2>

      {exam.sections.map((section) => (
        <section key={section.skill}>
          <h3>{section.skill}</h3>
          {section.items.map((item) => (
            <div key={item.id}>
              <p>{JSON.stringify(item.response)}</p>
              <p>
                {item.result ? `${item.result.score} / ${item.maxScore} — ${item.result.feedback}` : t("exams.grade.noAiResult")}
              </p>
            </div>
          ))}
        </section>
      ))}

      {exam.status === "submitted" && (
        <Button onClick={() => void handleGrade()} isLoading={busy}>
          {busy ? t("exams.grade.grading") : t("exams.grade.gradeButton")}
        </Button>
      )}

      {exam.aiScore !== null && (
        <p>
          {t("exams.grade.aiScoreLabel")}: {exam.aiScore}
          {exam.aiFeedback ? ` — ${exam.aiFeedback}` : ""}
        </p>
      )}

      {(exam.status === "submitted" || exam.status === "ai_graded") && (
        <>
          <Input
            label={t("exams.grade.scoreLabel")}
            type="number"
            min={0}
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <Button onClick={() => void handleValidate()} isLoading={busy}>
            {busy ? t("exams.grade.validating") : t("exams.grade.validate")}
          </Button>
          <p role="status">{t("exams.grade.countsForRecordNotice")}</p>
        </>
      )}

      {exam.status === "teacher_validated" && <p role="status">{t("exams.grade.validated")}</p>}
    </Card>
  );
}
