type LandingRecentActivityItemProps = {
  entry: string;
};

export function LandingRecentActivityItem({ entry }: LandingRecentActivityItemProps) {
  return (
    <li className="app-shell-caption rounded-md border border-border bg-card px-2.5 py-2 text-foreground/85 lg:px-2 lg:py-1.5">
      {entry}
    </li>
  );
}
