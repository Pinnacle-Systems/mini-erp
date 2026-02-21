import { motion } from "framer-motion";

export function SessionSplashPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6 md:p-10">
      <section className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/65 p-8 shadow-[0_22px_52px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="relative h-10 w-10">
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-primary/20"
              animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0.25, 0.7] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <span className="absolute inset-2 rounded-full bg-primary/90" />
          </div>
          <div>
            <p className="m-0 text-sm font-semibold text-foreground">
              Restoring your session
            </p>
            <p className="m-0 text-xs text-muted-foreground">
              Checking credentials and workspace access...
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
