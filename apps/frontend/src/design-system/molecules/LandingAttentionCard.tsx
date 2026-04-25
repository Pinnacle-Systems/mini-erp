type LandingAttentionCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function LandingAttentionCard({ label, value, detail }: LandingAttentionCardProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/70 p-2.5 lg:p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="app-shell-action-title font-medium">{label}</p>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary lg:px-2 lg:text-xs">
          {value}
        </span>
      </div>
      <p className="app-shell-caption mt-1">{detail}</p>
    </div>
  );
}
