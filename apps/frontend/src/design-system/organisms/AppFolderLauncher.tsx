import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export type FolderId = "store" | "sync";

export type AppFolder = {
  id: FolderId;
  label: string;
  accent: string;
  description: string;
};

type AppFolderLauncherProps = {
  folders: AppFolder[];
  activeFolder: FolderId;
  onSelect: (id: FolderId) => void;
};

export function AppFolderLauncher({ folders, activeFolder, onSelect }: AppFolderLauncherProps) {
  return (
    <section>
      <p className="mb-4 text-sm font-medium tracking-[0.01em] text-muted-foreground">Apps</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map((folder, index) => {
          const selected = folder.id === activeFolder;
          return (
            <motion.button
              key={folder.id}
              type="button"
              onClick={() => onSelect(folder.id)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.24, ease: "easeOut" }}
              className={cn(
                "group rounded-[20px] border border-white/70 bg-white/65 p-4 text-left shadow-[0_16px_36px_-28px_rgba(15,23,42,0.45)] backdrop-blur-lg transition duration-200",
                "hover:bg-white/85",
                selected && "border-primary/35 bg-primary/[0.10]"
              )}
            >
              <div className="relative h-16 w-20 rounded-2xl border border-white/80 bg-gradient-to-b from-white/80 to-muted p-2">
                <div className="grid h-full grid-cols-2 gap-1">
                  <span className={cn("rounded-sm", folder.accent)} />
                  <span className="rounded-sm bg-background" />
                  <span className="rounded-sm bg-foreground/15" />
                  <span className="rounded-sm bg-foreground/25" />
                </div>
                <div className="absolute -top-1 left-2 h-2 w-8 rounded-t-md bg-foreground/15" />
              </div>

              <p className="mt-3 text-sm font-semibold tracking-[0.01em] text-foreground">{folder.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{folder.description}</p>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
