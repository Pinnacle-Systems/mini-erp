import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

type AppFolderTileItem<TId extends string = string> = {
  id: TId;
  label: string;
  Icon: LucideIcon;
};

type AppFolderTileProps<TId extends string> = {
  label: string;
  apps: AppFolderTileItem<TId>[];
  onOpen: () => void;
};

export function AppFolderTile<TId extends string>({
  label,
  apps,
  onOpen,
}: AppFolderTileProps<TId>) {
  const previewApps = apps.slice(0, 9);

  return (
    <>
      <motion.section
        layout
        transition={{ type: "spring", damping: 24, stiffness: 320 }}
        onClick={onOpen}
        className="aspect-square w-full cursor-pointer rounded-[clamp(0.9rem,2vw,1.75rem)] border border-white/70 bg-white/60 p-[clamp(0.35rem,1vw,0.75rem)] shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl"
      >
        <motion.div
          layout
          className="grid h-full w-full grid-cols-3 grid-rows-3 place-items-center gap-[clamp(0.25rem,0.8vw,0.75rem)] rounded-[clamp(0.65rem,1.7vw,1.25rem)] border border-white/75 bg-gradient-to-b from-white/85 to-white/55 p-[clamp(0.35rem,1vw,0.75rem)]"
        >
          {previewApps.map((app) => (
            <span
              key={app.id}
              title={app.label}
              aria-label={app.label}
              className="flex h-full w-full items-center justify-center text-foreground/80"
            >
              <app.Icon className="h-[80%] w-[80%]" />
            </span>
          ))}
        </motion.div>
      </motion.section>
      <p className="mt-3 text-center text-[clamp(0.7rem,1.3vw,1rem)] font-medium leading-tight text-foreground/90">
        {label}
      </p>
    </>
  );
}
