import { useCallback, useId, useRef, useState } from "react";
import type { DragEvent, ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button, Card, Tag, useToast } from "../../../ui/index.js";
import { useErrorMessage } from "../../../i18n/errors.js";
import { useLocale, useT } from "../../../i18n/translate.js";
import { ApiError } from "../../../lib/api-client.js";
import { getGenerationEstimate } from "../api.js";
import { createUnitFromMaterial, uploadMaterial } from "./api.js";
import { CEFR_LEVELS, EXERCISE_TYPES, LANGUAGE_SKILLS } from "../types.js";
import { MATERIAL_FORMATS } from "./types.js";
import type { UploadItem } from "./types.js";

/**
 * Tamaño legible. No es una regla de negocio —el tope de 100 MB lo decide y
 * lo explica la API con su propio error traducido—, solo formato: por eso
 * puede vivir aquí.
 *
 * En kB por debajo del megabyte: verificándolo en el navegador, un PDF de
 * prueba de 600 bytes salía como «0 MB», que parece un fichero vacío.
 */
function formatBytes(bytes: number, locale: string): string {
  const unit = bytes < 1024 * 1024 ? "kB" : "MB";
  const value = unit === "kB" ? bytes / 1024 : bytes / (1024 * 1024);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

let sequence = 0;
function nextKey(): string {
  sequence += 1;
  return `subida-${sequence}`;
}

/**
 * Subida de material propio de la escuela (Tarea 14 de la ola 2, Paso 7):
 * arrastrar y soltar, con progreso real.
 *
 * Esta pantalla no valida NADA del fichero: ni el formato ni el tamaño. Los
 * dos los decide `UploadedMaterial.create()` en la API, por el contenido real
 * del fichero y no por su extensión —un `.pdf` renombrado no es un PDF—, y
 * responde con un error ya traducido que aquí solo se muestra. La lista de
 * formatos que se enseña al usuario es informativa, y el `accept` del
 * `<input type="file">` es una comodidad del selector nativo, no una
 * comprobación: quien suelte otra cosa recibirá el rechazo del servidor con
 * la lista de los válidos.
 *
 * Accesible sin ratón: la zona de soltar es un `<button>` de verdad, así que
 * el tabulador la alcanza y Enter o Espacio abren el selector de ficheros.
 * Arrastrar y soltar es el atajo, no el único camino.
 */
export function UploadMaterialScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const describeError = useErrorMessage();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropzoneId = useId();

  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);

  /**
   * Qué tipos de ejercicio se pueden pedir hoy lo decide la API, igual que en
   * el formulario de generación: aquí no hay una segunda copia de esa lista.
   * Se consulta una vez para toda la pantalla, no una por fichero.
   */
  const estimateQuery = useQuery({
    queryKey: ["content", "generation-estimate"],
    queryFn: getGenerationEstimate,
    staleTime: 60_000,
  });
  const unavailableTypes = new Set<string>(estimateQuery.data?.unavailableExerciseTypes ?? []);

  const patch = useCallback((key: string, changes: Partial<UploadItem>): void => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );
  }, []);

  const upload = useCallback(
    async (files: readonly File[]): Promise<void> => {
      for (const file of files) {
        const key = nextKey();
        setItems((current) => [
          ...current,
          { key, filename: file.name, bytes: file.size, status: "uploading", percent: 0 },
        ]);
        try {
          const result = await uploadMaterial(file, (percent) => patch(key, { percent }));
          patch(key, { status: "done", percent: 100, result });
          showToast({ variant: "success", title: t("content.upload.uploadSuccess") });
        } catch (cause) {
          patch(key, {
            status: "failed",
            error:
              cause instanceof ApiError
                ? describeError(cause.problem)
                : t("content.upload.genericError"),
          });
        }
      }
    },
    [describeError, patch, showToast, t],
  );

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    if (files.length > 0) void upload(files);
  };

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1>{t("content.upload.title")}</h1>
        <p>{t("content.upload.subtitle")}</p>
        <p>
          <Link to="/contenido">{t("content.review.backToList")}</Link>
        </p>
      </header>

      <Card title={t("content.upload.dropzoneTitle")}>
        <button
          type="button"
          id={dropzoneId}
          aria-label={t("content.upload.dropzoneLabel")}
          className={`border-2 border-dashed rounded-md p-8 w-full text-center ${
            dragging ? "border-accent" : "border-border"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span>{t("content.upload.dropzoneHint")}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label={t("content.upload.fileInputLabel")}
          accept={MATERIAL_FORMATS.map((format) => `.${format}`).join(",")}
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            // Se limpia el valor para que volver a elegir el MISMO fichero
            // dispare `change` otra vez (si no, el navegador lo considera sin
            // cambios y no pasa nada, que parece que la pantalla se cuelga).
            event.target.value = "";
            if (files.length > 0) void upload(files);
          }}
        />
        <p>{t("content.upload.acceptedFormats", { formats: MATERIAL_FORMATS.join(", ").toUpperCase() })}</p>
        <p>{t("content.upload.noCreditsHint")}</p>
      </Card>

      {items.length === 0 ? (
        <p role="status">{t("content.upload.emptyQueue")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.key}>
              <Card title={item.filename}>
                <p>{formatBytes(item.bytes, locale)}</p>

                {item.status === "uploading" && (
                  <progress
                    max={100}
                    value={item.percent}
                    aria-label={t("content.upload.progressLabel", { filename: item.filename })}
                  >
                    {item.percent}
                  </progress>
                )}

                {item.status === "failed" && <p role="alert">{item.error}</p>}

                {item.status === "done" && item.result && (
                  <MaterialResult result={item.result} unavailableTypes={unavailableTypes} />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * Lo que se puede hacer con un material ya subido. Si la API dice que quedó
 * indexado, se ofrece crear una unidad `hybrid` a partir de él; si no —un
 * audio, una imagen, o un PDF cuya indexación falló—, se explica por qué no
 * se puede todavía. Quién está indexado y quién no lo decide `indexed`, que
 * viene de la API.
 *
 * El formulario pide exactamente lo que exige `POST /learning/units/
 * from-material` y ni un campo más: nada aquí decide nivel, idioma ni tipos
 * por su cuenta. `source: "hybrid"` NO viaja en el cuerpo — una unidad creada
 * por esa ruta lo es por definición, no porque lo diga el cliente.
 */
function MaterialResult({
  result,
  unavailableTypes,
}: {
  result: NonNullable<UploadItem["result"]>;
  unavailableTypes: ReadonlySet<string>;
}): ReactElement {
  const t = useT();
  const locale = useLocale();
  const describeError = useErrorMessage();
  const { showToast } = useToast();
  const codeId = useId();
  const topicId = useId();
  const languageId = useId();
  const levelId = useId();

  const [code, setCode] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("es");
  const [level, setLevel] = useState<string>("B1");
  const [skills, setSkills] = useState<string[]>([]);
  const [exerciseTypes, setExerciseTypes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUnitId, setCreatedUnitId] = useState<string | null>(null);

  const toggle = (value: string, set: (updater: (current: string[]) => string[]) => void): void => {
    set((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const incomplete =
    code.trim() === "" ||
    topic.trim() === "" ||
    language.trim() === "" ||
    skills.length === 0 ||
    exerciseTypes.length === 0;

  const create = async (): Promise<void> => {
    setError(null);
    setCreating(true);
    try {
      const created = await createUnitFromMaterial({
        materialId: result.materialId,
        code,
        language,
        level,
        topic,
        skills,
        primaryLocale: locale,
        exerciseTypes,
      });
      setCreatedUnitId(created.contentUnitId);
      showToast({ variant: "success", title: t("content.upload.unitCreated") });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? describeError(cause.problem)
          : t("content.upload.genericError"),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <Tag variant="success">{t("content.upload.uploaded")}</Tag>
        <Tag variant={result.indexed ? "success" : "neutral"}>
          {result.indexed ? t("content.upload.indexed") : t("content.upload.notIndexed")}
        </Tag>
      </div>

      {!result.indexed && <p>{t("content.upload.notIndexedHint")}</p>}

      {result.indexed && createdUnitId === null && (
        <div className="flex flex-col gap-2">
          <p>{t("content.upload.createUnitHint")}</p>

          <label htmlFor={codeId}>{t("content.form.codeLabel")}</label>
          <input id={codeId} value={code} onChange={(event) => setCode(event.target.value)} />

          <label htmlFor={languageId}>{t("content.form.languageLabel")}</label>
          <input
            id={languageId}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          />

          <label htmlFor={levelId}>{t("content.form.levelLabel")}</label>
          <select id={levelId} value={level} onChange={(event) => setLevel(event.target.value)}>
            {CEFR_LEVELS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <label htmlFor={topicId}>{t("content.form.topicLabel")}</label>
          <input id={topicId} value={topic} onChange={(event) => setTopic(event.target.value)} />

          <fieldset>
            <legend>{t("content.form.skillsLabel")}</legend>
            {LANGUAGE_SKILLS.map((skill) => (
              <label key={skill} className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={skills.includes(skill)}
                  onChange={() => toggle(skill, setSkills)}
                />
                {t(`content.skill.${skill}`)}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>{t("content.form.exerciseTypesLabel")}</legend>
            {EXERCISE_TYPES.map((type) => {
              const unavailable = unavailableTypes.has(type);
              return (
                <label key={type} className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    disabled={unavailable}
                    checked={exerciseTypes.includes(type)}
                    onChange={() => toggle(type, setExerciseTypes)}
                  />
                  {t(`content.exerciseType.${type}`)}
                  {unavailable && <span>{t("content.form.audioDisabledHint")}</span>}
                </label>
              );
            })}
          </fieldset>

          {error && <p role="alert">{error}</p>}
          <Button type="button" isLoading={creating} disabled={incomplete} onClick={() => void create()}>
            {creating ? t("content.upload.creatingUnit") : t("content.upload.createUnit")}
          </Button>
        </div>
      )}

      {createdUnitId !== null && (
        <p>
          <Link to="/contenido/$contentUnitId" params={{ contentUnitId: createdUnitId }}>
            {t("content.upload.goToUnit")}
          </Link>
        </p>
      )}
    </div>
  );
}
