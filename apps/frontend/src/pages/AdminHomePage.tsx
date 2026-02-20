import { AnimatePresence, motion } from "framer-motion";
import { Store, Users, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconButton } from "../design-system/atoms/IconButton";

type AdminAppId = "stores" | "users";

const adminApps: Array<{
  id: AdminAppId;
  label: string;
  Icon: typeof Store;
  route: string;
}> = [
  {
    id: "stores",
    label: "Stores",
    Icon: Store,
    route: "/app/stores",
  },
  {
    id: "users",
    label: "Users",
    Icon: Users,
    route: "/app/users",
  },
];

export function AdminHomePage() {
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const navigate = useNavigate();
  const previewApps = adminApps.slice(0, 9);
  const folderLabel = "Admin Apps";

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 p-6 md:p-10">
      <div className="w-full max-w-[14rem]">
        <motion.section
          layout
          transition={{ type: "spring", damping: 24, stiffness: 320 }}
          onClick={() => setIsFolderOpen(true)}
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
          {folderLabel}
        </p>
      </div>

      <AnimatePresence>
        {isFolderOpen ? (
          <>
            <motion.div
              key="folder-backdrop"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFolderOpen(false)}
            />
            <motion.div
              key="folder-modal"
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              onClick={() => setIsFolderOpen(false)}
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
                    setIsFolderOpen(false);
                  }}
                  className="absolute right-4 top-4 h-8 w-8 bg-white/20 text-white hover:bg-white/30"
                  aria-label="Close folder"
                />

                <p className="mb-5 text-center text-[clamp(0.75rem,1.4vw,1.05rem)] font-medium text-white/90">
                  {folderLabel}
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
                        setIsFolderOpen(false);
                        navigate(app.route);
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
                      key={`admin-app-grid-spacer-${index}`}
                      aria-hidden
                      className="h-[clamp(2.9rem,9vw,5.4rem)] w-full"
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
