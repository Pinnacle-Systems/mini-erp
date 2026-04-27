import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../molecules/Card";

export type ModuleOverviewAction = {
  label: string;
  description: string;
  to: string;
  Icon: LucideIcon;
};

type ModuleOverviewProps = {
  title: string;
  description: string;
  primaryActions: ModuleOverviewAction[];
  secondaryActions?: ModuleOverviewAction[];
  onOpen: (to: string) => void;
};

function OverviewActionButton({
  action,
  onOpen,
}: {
  action: ModuleOverviewAction;
  onOpen: (to: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(action.to)}
      className="group flex min-h-[4.75rem] w-full min-w-0 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-primary/35 hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/65 text-foreground">
        <action.Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground lg:text-xs">
          {action.label}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground lg:text-[11px]">
          {action.description}
        </span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary"
        aria-hidden="true"
      />
    </button>
  );
}

export function ModuleOverview({
  title,
  description,
  primaryActions,
  secondaryActions = [],
  onOpen,
}: ModuleOverviewProps) {
  const hasSecondaryActions = secondaryActions.length > 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/70 pb-2">
        <div className="min-w-0">
          <h1 className="app-shell-primary-title">{title}</h1>
          <p className="app-shell-description mt-1 max-w-3xl">{description}</p>
        </div>
      </div>

      <div
        className={
          hasSecondaryActions
            ? "grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)] lg:overflow-hidden"
            : "grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:overflow-hidden"
        }
      >
        <Card className="min-h-0 p-2 lg:flex lg:flex-col">
          <CardHeader className="mb-2 p-0">
            <CardTitle className="text-sm">Workflows</CardTitle>
            <CardDescription>Open the main screens for this module.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3 lg:min-h-0 lg:overflow-y-auto">
            {primaryActions.map((action) => (
              <OverviewActionButton
                key={action.to}
                action={action}
                onOpen={onOpen}
              />
            ))}
          </CardContent>
        </Card>

        {hasSecondaryActions ? (
          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="mb-2 p-0">
              <CardTitle className="text-sm">Related</CardTitle>
              <CardDescription>Supporting screens and reference lists.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 p-0 lg:min-h-0 lg:overflow-y-auto">
              {secondaryActions.map((action) => (
                <OverviewActionButton
                  key={action.to}
                  action={action}
                  onOpen={onOpen}
                />
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
