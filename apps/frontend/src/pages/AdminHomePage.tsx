import { Business, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../design-system/molecules/Card";

type AdminAppId = "businesses" | "users";

const adminApps: Array<{
  id: AdminAppId;
  label: string;
  Icon: typeof Business;
  route: string;
}> = [
  {
    id: "businesses",
    label: "Businesses",
    Icon: Business,
    route: "/app/businesses",
  },
  {
    id: "users",
    label: "Users",
    Icon: Users,
    route: "/app/users",
  },
];

export function AdminHomePage() {
  const navigate = useNavigate();
  const primaryApp = adminApps[0];

  return (
    <main className="min-h-screen w-full p-4 pb-24 sm:p-6 sm:pb-28 md:p-10 lg:pb-10">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden rounded-3xl border border-white/70 bg-white/60 p-3 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl lg:block">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Admin Menu
          </p>
          <div className="space-y-1.5">
            {adminApps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => navigate(app.route)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground/80 transition hover:bg-white/70"
              >
                <app.Icon className="h-4 w-4 shrink-0" />
                <span>{app.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Admin</CardTitle>
              <CardDescription>
                Use the menu to manage platform businesses and users.
              </CardDescription>
            </CardHeader>
          </Card>

          <section className="flex flex-wrap gap-2">
            {adminApps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => navigate(app.route)}
                className="h-10 rounded-full border border-[#9cb5d2] bg-gradient-to-b from-[#f8fbff] to-[#e7f1ff] px-4 text-xs font-semibold text-[#15314e] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(21,49,78,0.5)] transition hover:from-[#ffffff] hover:to-[#edf5ff]"
              >
                Open {app.label}
              </button>
            ))}
          </section>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/90 p-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md gap-1">
          {adminApps.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => navigate(app.route)}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] leading-tight transition ${
                app.id === primaryApp?.id
                  ? "bg-[#e8f2ff] text-[#163a63]"
                  : "text-foreground/75 hover:bg-white/80"
              }`}
            >
              <app.Icon className="h-4 w-4" />
              <span className="text-center">{app.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
