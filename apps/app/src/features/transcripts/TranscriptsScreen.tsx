import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, EmptyState, ErrorState, Input, Skeleton, Tag } from "../../ui/index.js";
import type { TagVariant } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { listTranscripts } from "./api.js";
import type { TranscriptStatus } from "./api.js";

const STATUS_VARIANT: Record<TranscriptStatus, TagVariant> = {
  pending: "neutral",
  recording: "warning",
  processing: "warning",
  ready: "success",
  blocked_no_consent: "critical",
  failed: "critical",
};

export function TranscriptsScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["transcripts", "list"], queryFn: listTranscripts });
  const rows = query.data ?? [];
  const selected = rows.find((row) => row.transcriptId === selectedId) ?? rows[0] ?? null;
  const segments = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!selected) return [];
    if (!needle) return selected.segments;
    return selected.segments.filter((segment) => segment.text.toLocaleLowerCase().includes(needle));
  }, [selected, search]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("transcripts.title")}</h1>

      {query.isPending && (
        <>
          <p role="status">{t("common.loading")}</p>
          <Skeleton variant="text" lines={4} />
        </>
      )}

      {query.error && (
        <ErrorState
          title={query.error instanceof ApiError ? errorMessage(query.error.problem) : t("transcripts.errorTitle")}
          action={<Button onClick={() => void query.refetch()}>{t("common.retry")}</Button>}
        />
      )}

      {!query.isPending && !query.error && rows.length === 0 && (
        <EmptyState title={t("transcripts.emptyTitle")} description={t("transcripts.emptyDescription")} />
      )}

      {!query.isPending && !query.error && rows.length > 0 && selected && (
        <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(240px, 320px) minmax(0, 1fr)" }}>
          <section>
            <h2 className="text-xl font-semibold mb-3">{t("transcripts.listTitle")}</h2>
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <Button
                  key={row.transcriptId}
                  variant={row.transcriptId === selected.transcriptId ? "primary" : "secondary"}
                  onClick={() => {
                    setSelectedId(row.transcriptId);
                    setSearch("");
                  }}
                  aria-label={t("transcripts.openAria", { title: row.title })}
                >
                  {row.title}
                </Button>
              ))}
            </div>
          </section>

          <section aria-label={t("transcripts.viewerLabel")}>
            <Card
              title={selected.title}
              actions={<Tag variant={STATUS_VARIANT[selected.status]}>{t(`transcripts.status.${selected.status}`)}</Tag>}
            >
              <div className="flex flex-col gap-4">
                {selected.status === "blocked_no_consent" && (
                  <div role="alert">
                    <h2 className="text-lg font-semibold">{t("transcripts.blockedTitle")}</h2>
                    <p>{selected.blockedReason ?? t("transcripts.blockedFallback")}</p>
                  </div>
                )}

                {selected.summary && (
                  <section>
                    <h2 className="text-lg font-semibold">{t("transcripts.summaryTitle")}</h2>
                    <p>{selected.summary}</p>
                  </section>
                )}

                {selected.status === "ready" && (
                  <>
                    <Input
                      id="transcript-search"
                      label={t("transcripts.searchLabel")}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {segments.length === 0 ? (
                      <EmptyState
                        title={t("transcripts.noSearchResultsTitle")}
                        description={t("transcripts.noSearchResultsDescription")}
                      />
                    ) : (
                      <ol className="flex flex-col gap-3">
                        {segments.map((segment) => (
                          <li key={segment.segmentId}>
                            <p className="font-medium">
                              <time>{formatTimestamp(segment.startMs)}</time>
                              {" · "}
                              {segment.speakerLabel ?? t("transcripts.unknownSpeaker")}
                            </p>
                            <p>{segment.text}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </div>
            </Card>
          </section>
        </div>
      )}
    </main>
  );
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
