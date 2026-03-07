import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../molecules/Card";
import type { SyncResultRecord } from "../../features/sync/types";

type SyncResultsPanelProps = {
  loading: boolean;
  results: SyncResultRecord[];
};

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const getResultToneClasses = (result: SyncResultRecord) =>
  result.resultStatus === "applied"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";

export function SyncResultsPanel({ loading, results }: SyncResultsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Results</CardTitle>
        <CardDescription>
          Durable sync outcome history for this business. Applied archive and purge results remain
          available even after local cache reset.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading recent sync results...</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No processed sync results available for this business yet.
          </p>
        ) : (
          <div className="space-y-3">
            {results.map((result) => {
              const archivedCount = result.outcome?.archived.length ?? 0;
              const purgedCount = result.outcome?.purged.length ?? 0;

              return (
                <article
                  key={result.mutationId}
                  className="rounded-xl border border-border/70 bg-card px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {result.entity.replaceAll("_", " ")}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${getResultToneClasses(result)}`}
                        >
                          {result.resultStatus}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{result.summary}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{formatTimestamp(result.processedAt)}</p>
                      <p className="uppercase tracking-wide">{result.operation}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Entity ID: {result.entityId}</span>
                    {archivedCount > 0 ? <span>Archived: {archivedCount}</span> : null}
                    {purgedCount > 0 ? <span>Purged: {purgedCount}</span> : null}
                    {result.rejection?.reasonCode ? (
                      <span>Reason: {result.rejection.reasonCode.replaceAll("_", " ")}</span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
