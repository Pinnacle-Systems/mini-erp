type LandingRecentActivityItemProps = {
  entry: string;
};

export function LandingRecentActivityItem({ entry }: LandingRecentActivityItemProps) {
  return (
    <li className="rounded-lg border border-white/75 bg-white/70 px-2 py-1.5 text-[11px] text-foreground/85">
      {entry}
    </li>
  );
}
