type LandingAttentionCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function LandingAttentionCard({ label, value, detail }: LandingAttentionCardProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/70 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {value}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}
