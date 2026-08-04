import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Panel, EmptyState, ErrorState, Input, Selector, Skeleton, Chip } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import {
  getEditableSite,
  publishSite,
  saveSitePageBlocks,
  unpublishSite,
  type EditableSite,
  type EditableSitePage,
  type EditableTeacherOption,
  type SiteBlock,
  type SiteBlockType,
} from "./api.js";

const BLOCK_TYPES: SiteBlockType[] = [
  "hero",
  "courses",
  "teachers",
  "pricing",
  "testimonials",
  "faq",
  "contact",
  "text",
];

export function SiteEditorScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [selectedLocale, setSelectedLocale] = useState<string>("");
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [success, setSuccess] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["sites", "editor"], queryFn: getEditableSite });

  const site = query.data;
  const locale = selectedLocale || site?.site.primaryLocale || site?.locales[0] || "";
  const pagesForLocale = useMemo(
    () => site?.pages.filter((page) => page.locale === locale) ?? [],
    [site?.pages, locale],
  );
  const page = pagesForLocale.find((candidate) => candidate.id === selectedPageId) ?? pagesForLocale[0] ?? null;

  const saveMutation = useMutation({
    mutationFn: (input: { pageId: string; blocks: SiteBlock[] }) => saveSitePageBlocks(input.pageId, input.blocks),
    onSuccess: async () => {
      setSuccess(t("sites.editor.saveSuccess"));
      await query.refetch();
    },
  });
  const publishMutation = useMutation({
    mutationFn: publishSite,
    onSuccess: async () => {
      setSuccess(t("sites.editor.publishSuccess"));
      await query.refetch();
    },
  });
  const unpublishMutation = useMutation({
    mutationFn: unpublishSite,
    onSuccess: async () => {
      setSuccess(t("sites.editor.unpublishSuccess"));
      await query.refetch();
    },
  });

  if (query.isPending) {
    return (
      <main className="p-6">
        <p role="status">{t("common.loading")}</p>
        <Skeleton variant="text" lines={6} />
      </main>
    );
  }

  if (query.error) {
    return (
      <main className="p-6">
        <ErrorState
          title={query.error instanceof ApiError ? errorMessage(query.error.problem) : t("sites.editor.errorTitle")}
          action={<Button onClick={() => void query.refetch()}>{t("common.retry")}</Button>}
        />
      </main>
    );
  }

  if (!site || !page) {
    return (
      <main className="p-6">
        <EmptyState title={t("sites.editor.emptyTitle")} description={t("sites.editor.emptyDescription")} />
      </main>
    );
  }

  const mutationError = saveMutation.error ?? publishMutation.error ?? unpublishMutation.error;

  return (
    <main className="p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-2">{t("sites.editor.title")}</h1>
          <Chip variant={site.site.status === "published" ? "success" : "warning"}>
            {t(`sites.editor.status.${site.site.status}`)}
          </Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => publishMutation.mutate()}
            isLoading={publishMutation.isPending}
          >
            {t("sites.editor.publish")}
          </Button>
          <Button
            variant="danger"
            onClick={() => unpublishMutation.mutate()}
            isLoading={unpublishMutation.isPending}
          >
            {t("sites.editor.unpublish")}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Selector
          id="site-editor-locale"
          label={t("sites.editor.localeLabel")}
          value={locale}
          onChange={(event) => {
            setSelectedLocale(event.target.value);
            setSelectedPageId("");
          }}
          options={site.locales.map((value) => ({ value, label: value }))}
        />
        <Selector
          id="site-editor-page"
          label={t("sites.editor.pageLabel")}
          value={page.id}
          onChange={(event) => setSelectedPageId(event.target.value)}
          options={pagesForLocale.map((candidate) => ({
            value: candidate.id,
            label: candidate.isHome ? t("sites.editor.homePage", { title: candidate.title }) : candidate.title,
          }))}
        />
      </div>

      {success && <p>{success}</p>}
      {mutationError && (
        <p role="alert">
          {mutationError instanceof ApiError ? errorMessage(mutationError.problem) : t("sites.editor.genericError")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <section className="flex flex-col gap-4" aria-label={t("sites.editor.blocksLabel")}>
          <BlockEditor
            page={page}
            site={site}
            onSave={(blocks) => saveMutation.mutate({ pageId: page.id, blocks })}
            isSaving={saveMutation.isPending}
          />
        </section>
        <aside className="flex flex-col gap-4">
          <Panel title={t("sites.editor.previewTitle")}>
            <iframe
              title={t("sites.editor.previewTitle")}
              src={site.site.previewUrl}
              className="min-h-[520px] w-full rounded-lg border border-border bg-white lg:min-h-[640px]"
            />
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function BlockEditor(props: {
  page: EditableSitePage;
  site: EditableSite;
  onSave: (blocks: SiteBlock[]) => void;
  isSaving: boolean;
}): ReactElement {
  const t = useT();
  const [blocks, setBlocks] = useState(() => props.page.blocks);

  useEffect(() => {
    setBlocks(props.page.blocks);
  }, [props.page.id, props.page.blocks]);

  const addBlock = (type: SiteBlockType): void => {
    setBlocks((current) => [...current, defaultBlock(type, props.site.teacherOptions)]);
  };

  return (
    <>
      <Panel
        title={props.page.title}
        actions={
          <Selector
            aria-label={t("sites.editor.addBlock")}
            label={t("sites.editor.addBlock")}
            value=""
            placeholder={t("sites.editor.blockPlaceholder")}
            onChange={(event) => addBlock(event.target.value as SiteBlockType)}
            options={BLOCK_TYPES.map((type) => ({ value: type, label: t(`sites.editor.blockType.${type}`) }))}
          />
        }
        footer={
          <Button onClick={() => props.onSave(blocks)} isLoading={props.isSaving}>
            {t("sites.editor.save")}
          </Button>
        }
      >
        {blocks.length === 0 ? (
          <EmptyState title={t("sites.editor.noBlocksTitle")} description={t("sites.editor.noBlocksDescription")} />
        ) : (
          <ol className="flex flex-col gap-3">
            {blocks.map((block, index) => (
              <li key={block.id}>
                <Panel>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold">{t(`sites.editor.blockType.${block.type}`)}</h2>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={index === 0}
                        aria-label={t("sites.editor.moveUp")}
                        onClick={() => setBlocks(move(blocks, index, index - 1))}
                      >
                        {t("sites.editor.up")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={index === blocks.length - 1}
                        aria-label={t("sites.editor.moveDown")}
                        onClick={() => setBlocks(move(blocks, index, index + 1))}
                      >
                        {t("sites.editor.down")}
                      </Button>
                    </div>
                  </div>
                  <BlockFields
                    block={block}
                    teacherOptions={props.site.teacherOptions}
                    onChange={(updated) =>
                      setBlocks(blocks.map((candidate) => (candidate.id === updated.id ? updated : candidate)))
                    }
                  />
                </Panel>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}

function BlockFields(props: {
  block: SiteBlock;
  teacherOptions: EditableTeacherOption[];
  onChange: (block: SiteBlock) => void;
}): ReactElement {
  const t = useT();
  const update = (patch: Record<string, unknown>): void =>
    props.onChange({ ...props.block, props: { ...props.block.props, ...patch } });

  if (props.block.type === "hero") {
    const image = objectProp(props.block.props.image);
    const cta = objectProp(props.block.props.callToAction);
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label={t("sites.editor.fieldHeadline")} value={textProp(props.block.props.headline)} onChange={(event) => update({ headline: event.target.value })} />
        <Input label={t("sites.editor.fieldSubtitle")} value={textProp(props.block.props.subtitle)} onChange={(event) => update({ subtitle: event.target.value })} />
        <div className="col-span-full">
          <Input label={t("sites.editor.fieldImageUrl")} value={textProp(image.url)} onChange={(event) => update({ image: { ...image, url: event.target.value } })} />
        </div>
        <Input label={t("sites.editor.fieldCtaLabel")} value={textProp(cta.label)} onChange={(event) => update({ callToAction: { ...cta, label: event.target.value } })} />
        <Input label={t("sites.editor.fieldCtaHref")} value={textProp(cta.href)} onChange={(event) => update({ callToAction: { ...cta, href: event.target.value } })} />
      </div>
    );
  }

  if (props.block.type === "teachers") {
    const selected = teachersProp(props.block.props.teachers);
    return (
      <div className="flex flex-col gap-2">
        {props.teacherOptions.map((teacher) => {
          const checked = selected.some((candidate) => candidate.teacherId === teacher.teacherId);
          return (
            <label key={teacher.teacherId} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, teacher]
                    : selected.filter((candidate) => candidate.teacherId !== teacher.teacherId);
                  update({ teachers: next });
                }}
              />
              <span>
                {teacher.displayName}
                {!teacher.imageRights && <p className="mt-1 text-sm text-[#9a3412]">{t("sites.editor.imageRightsWarning")}</p>}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  if (props.block.type === "faq") {
    const first = faqItems(props.block.props.items)[0] ?? { question: "", answer: "" };
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label={t("sites.editor.fieldQuestion")} value={first.question} onChange={(event) => update({ items: [{ ...first, question: event.target.value }] })} />
        <Input label={t("sites.editor.fieldAnswer")} value={first.answer} onChange={(event) => update({ items: [{ ...first, answer: event.target.value }] })} />
      </div>
    );
  }

  if (props.block.type === "contact") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label={t("sites.editor.fieldTitle")} value={textProp(props.block.props.title)} onChange={(event) => update({ title: event.target.value })} />
        <Input label={t("sites.editor.fieldSubmitLabel")} value={textProp(props.block.props.submitLabel)} onChange={(event) => update({ submitLabel: event.target.value, leadSource: "school_site" })} />
      </div>
    );
  }

  if (props.block.type === "text") {
    const first = richText(props.block.props.content)[0] ?? { kind: "paragraph", text: "" };
    return (
      <Input
        label={t("sites.editor.fieldText")}
        value={first.text}
        onChange={(event) => update({ content: [{ kind: "paragraph", text: event.target.value }] })}
      />
    );
  }

  return (
    <Input
      label={t("sites.editor.fieldIds")}
      value={idsForBlock(props.block).join(", ")}
      onChange={(event) => update(idsPatch(props.block.type, event.target.value))}
    />
  );
}

function defaultBlock(type: SiteBlockType, teachers: readonly EditableTeacherOption[]): SiteBlock {
  const id = globalThis.crypto?.randomUUID?.() ?? `block-${Date.now()}`;
  if (type === "hero") {
    return {
      id,
      type,
      props: {
        headline: "Nuevo titular",
        subtitle: "Subtítulo de la sección",
        image: { url: "/hero.webp", alt: "Imagen principal" },
        callToAction: { label: "Contactar", href: "/contacto" },
      },
    };
  }
  if (type === "courses") return { id, type, props: { source: { kind: "all_active" } } };
  if (type === "teachers") return { id, type, props: { teachers: teachers.slice(0, 1) } };
  if (type === "pricing") return { id, type, props: { planIds: ["growth"] } };
  if (type === "testimonials") return { id, type, props: { testimonials: [] } };
  if (type === "faq") return { id, type, props: { items: [{ question: "Pregunta", answer: "Respuesta" }] } };
  if (type === "contact") return { id, type, props: { title: "Hablemos", submitLabel: "Enviar", leadSource: "school_site" } };
  return { id, type, props: { content: [{ kind: "paragraph", text: "Texto de la sección" }] } };
}

function move(blocks: SiteBlock[], from: number, to: number): SiteBlock[] {
  const copy = [...blocks];
  const [item] = copy.splice(from, 1);
  if (!item) return blocks;
  copy.splice(to, 0, item);
  return copy;
}

function objectProp(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textProp(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function teachersProp(value: unknown): EditableTeacherOption[] {
  return Array.isArray(value) ? value.filter((item): item is EditableTeacherOption => objectProp(item).teacherId !== undefined) : [];
}

function faqItems(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value) || value.length === 0) return [{ question: "", answer: "" }];
  return value.map((item) => {
    const raw = objectProp(item);
    return { question: textProp(raw.question), answer: textProp(raw.answer) };
  });
}

function richText(value: unknown): Array<{ kind: "paragraph"; text: string }> {
  if (!Array.isArray(value) || value.length === 0) return [{ kind: "paragraph", text: "" }];
  const raw = objectProp(value[0]);
  return [{ kind: "paragraph", text: textProp(raw.text) }];
}

function idsForBlock(block: SiteBlock): string[] {
  if (block.type === "pricing") return Array.isArray(block.props.planIds) ? block.props.planIds.map(String) : [];
  if (block.type === "courses") {
    const source = objectProp(block.props.source);
    return Array.isArray(source.courseIds) ? source.courseIds.map(String) : [];
  }
  return [];
}

function idsPatch(type: SiteBlockType, value: string): Record<string, unknown> {
  const ids = value.split(",").map((id) => id.trim()).filter(Boolean);
  if (type === "pricing") return { planIds: ids };
  if (type === "courses") return { source: ids.length > 0 ? { kind: "selected", courseIds: ids } : { kind: "all_active" } };
  return {};
}
