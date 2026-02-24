import { Building2, Users } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

type AdminMenuId = "businesses" | "users";

const adminMenu: Array<{
  id: AdminMenuId;
  label: string;
  Icon: typeof Building2;
  route: string;
}> = [
  {
    id: "businesses",
    label: "Businesses",
    Icon: Building2,
    route: "/app/businesses",
  },
  {
    id: "users",
    label: "Users",
    Icon: Users,
    route: "/app/users",
  },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <main className="min-h-screen w-full px-2 pt-2 pb-20 sm:px-3 sm:pt-3 sm:pb-24 lg:h-[calc(100dvh-4rem)] lg:min-h-0 lg:overflow-hidden lg:pb-3">
      <div className="grid w-full gap-2 lg:h-full lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden rounded-2xl border border-white/70 bg-white/60 p-2 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl lg:block lg:h-full">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Admin Menu
          </p>
          <div className="space-y-1.5">
            {adminMenu.map((menu) => {
              const isActive =
                location.pathname === menu.route ||
                location.pathname.startsWith(`${menu.route}/`);
              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => navigate(menu.route)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-[#e8f2ff] text-[#163a63]"
                      : "text-foreground/80 hover:bg-white/70"
                  }`}
                >
                  <menu.Icon className="h-4 w-4 shrink-0" />
                  <span>{menu.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-2 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <Outlet />
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/90 p-1.5 backdrop-blur-xl lg:hidden">
        <div className="flex w-full gap-1">
          {adminMenu.map((menu) => {
            const isActive =
              location.pathname === menu.route ||
              location.pathname.startsWith(`${menu.route}/`);
            return (
              <button
                key={menu.id}
                type="button"
                onClick={() => navigate(menu.route)}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] leading-tight transition ${
                  isActive
                    ? "bg-[#e8f2ff] text-[#163a63]"
                    : "text-foreground/75 hover:bg-white/80"
                }`}
              >
                <menu.Icon className="h-4 w-4" />
                <span className="text-center">{menu.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
