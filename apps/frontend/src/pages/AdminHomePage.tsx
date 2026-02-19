import { AnimatePresence, motion } from "framer-motion";
import { Store, Users, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 p-6 md:p-10">
      <motion.section
        layout
        transition={{ type: "spring", damping: 24, stiffness: 320 }}
        onClick={() => setIsFolderOpen(true)}
        className="aspect-square w-[clamp(180px,20vw,240px)] cursor-pointer rounded-[28px] border border-white/70 bg-white/60 p-3 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl"
      >
        <motion.div
          layout
          className="grid h-full w-full grid-cols-3 grid-rows-3 content-start gap-3 rounded-[20px] border border-white/75 bg-gradient-to-b from-white/85 to-white/55 p-3"
        >
          {previewApps.map((app) => (
            <span
              key={app.id}
              title={app.label}
              aria-label={app.label}
              className="flex h-12 w-12 items-center justify-center self-start text-foreground/80"
            >
              <app.Icon size={24} />
            </span>
          ))}
        </motion.div>
      </motion.section>

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
                className="relative h-[430px] w-full max-w-[430px] rounded-[40px] border border-white/15 bg-white/20 p-8 shadow-2xl backdrop-blur-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsFolderOpen(false);
                  }}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                  aria-label="Close folder"
                >
                  <X size={16} />
                </button>

                <p className="mb-5 text-center text-sm font-medium text-white/90">
                  Admin Apps
                </p>
                <div
                  className="grid grid-cols-3 gap-7 place-items-center px-2 py-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {previewApps.map((app) => (
                    <motion.button
                      key={app.id}
                      layout
                      type="button"
                      title={app.label}
                      aria-label={app.label}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setIsFolderOpen(false);
                        navigate(app.route);
                      }}
                      className="flex cursor-pointer flex-col items-center gap-2"
                    >
                      <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-white/85 text-foreground shadow-lg">
                        <app.Icon size={32} />
                      </span>
                      <span className="text-xs font-medium text-white">
                        {app.label}
                      </span>
                    </motion.button>
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
