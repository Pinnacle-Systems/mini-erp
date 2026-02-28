type LandingRecentActivityItemProps = {
  entry: string;
};

export function LandingRecentActivityItem({ entry }: LandingRecentActivityItemProps) {
  return (
    <li className="rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-foreground/85">
      {entry}
    </li>
  );
}
