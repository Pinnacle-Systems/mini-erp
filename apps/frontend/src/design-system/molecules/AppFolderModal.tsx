import type { ReactNode } from "react";
import { IconButton } from "../atoms/IconButton";
import { X, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type AppFolderModalItem<TId extends string = string> = {
  id: TId;
  label: string;
  Icon: LucideIcon;
};

type AppFolderModalProps<TId extends string> = {
  label: string;
  apps: AppFolderModalItem<TId>[];
  isOpen: boolean;
  onClose: () => void;
  onSelectApp: (id: TId) => void;
  closeOnSelect?: boolean;
  children?: ReactNode;
};

export function AppFolderModal<TId extends string>({
  label,
  apps,
  isOpen,
  onClose,
  onSelectApp,
  closeOnSelect = false,
  children,
}: AppFolderModalProps<TId>) {
  const previewApps = apps.slice(0, 9);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="folder-backdrop"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="folder-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            onClick={onClose}
          >
            <motion.div
              layout
              className="relative h-[min(72vh,500px)] w-[min(88vw,500px)] overflow-y-auto rounded-[34px] border border-white/15 bg-white/20 p-5 shadow-2xl backdrop-blur-2xl md:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <IconButton
                icon={X}
                type="button"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                className="absolute right-4 top-4 h-8 w-8 bg-white/20 text-white hover:bg-white/30"
                aria-label="Close folder"
              />
              <p className="mb-5 text-center text-[clamp(0.75rem,1.4vw,1.05rem)] font-medium text-white/90">
                {label}
              </p>
              <div
                className="grid grid-cols-3 gap-[clamp(0.5rem,2vw,1.75rem)] place-items-center px-1 py-1 sm:px-2"
                onClick={(event) => event.stopPropagation()}
              >
                {previewApps.map((app) => (
                  <motion.button
                    key={app.id}
                    type="button"
                    title={app.label}
                    aria-label={app.label}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      onSelectApp(app.id);
                      if (closeOnSelect) {
                        onClose();
                      }
                    }}
                    className="flex w-full cursor-pointer flex-col items-center gap-[clamp(0.3rem,1vw,0.5rem)] rounded-2xl border border-transparent bg-transparent p-[clamp(0.25rem,0.8vw,0.5rem)] transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
                  >
                    <span className="flex h-[clamp(2.9rem,9vw,5.4rem)] w-[clamp(2.9rem,9vw,5.4rem)] items-center justify-center rounded-[clamp(0.8rem,2vw,1.2rem)] bg-white/85 text-foreground shadow-lg">
                      <app.Icon className="h-[clamp(1.2rem,4.6vw,2.5rem)] w-[clamp(1.2rem,4.6vw,2.5rem)]" />
                    </span>
                    <span className="text-center text-[clamp(0.68rem,1.4vw,0.95rem)] font-medium leading-tight text-white">
                      {app.label}
                    </span>
                  </motion.button>
                ))}
                {Array.from({ length: (3 - (previewApps.length % 3)) % 3 }).map((_, index) => (
                  <span
                    key={`app-folder-grid-spacer-${index}`}
                    aria-hidden
                    className="h-[clamp(2.9rem,9vw,5.4rem)] w-full"
                  />
                ))}
              </div>
              {children}
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
