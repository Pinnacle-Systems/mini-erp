import { AlertTriangle } from "lucide-react";
import { Button } from "../atoms/Button";
import { Card } from "../molecules/Card";

export type DraftReviewAlert = {
  id: string;
  title: string;
  description: string;
};

type DraftReviewPanelProps = {
  title: string;
  description: string;
  alerts: DraftReviewAlert[];
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
};

export function DraftReviewPanel({
  title,
  description,
  alerts,
  actionLabel,
  actionDisabled = false,
  onAction,
}: DraftReviewPanelProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/80 p-0">
      <div className="flex flex-col gap-3 px-3 py-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
            <p className="text-xs font-semibold text-amber-900">{title}</p>
          </div>
          <p className="text-[11px] text-amber-800">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-amber-300 bg-white text-[11px] text-amber-900 hover:bg-amber-100"
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
      <div className="border-t border-amber-200 px-3 py-2">
        <div className="grid gap-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-md border border-amber-200 bg-white/90 px-2.5 py-2"
            >
              <p className="text-[11px] font-semibold text-amber-950">{alert.title}</p>
              <p className="mt-0.5 text-[11px] text-amber-800">{alert.description}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
