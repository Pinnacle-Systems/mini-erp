import { Building2, Users } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

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
  const location = useLocation();

  return (
    <main className="min-h-[calc(100vh-3.5rem)] w-full px-2 pt-1 pb-20 sm:min-h-[calc(100vh-4rem)] sm:px-3 sm:pt-1 sm:pb-24 lg:h-[calc(100vh-4rem)] lg:overflow-hidden lg:pb-3">
      <div className="grid w-full gap-2 lg:h-full lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="hidden h-full overflow-y-auto rounded-xl border border-border/80 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_24px_-20px_rgba(15,23,42,0.18)] lg:block">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Admin Menu
          </p>
          <div className="space-y-1.5">
            {adminMenu.map((menu) => {
              const isActive =
                location.pathname === menu.route ||
                location.pathname.startsWith(`${menu.route}/`);
              return (
                <Link
                  key={menu.id}
                  to={menu.route}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-[#e8f2ff] text-[#163a63]"
                      : "text-foreground/80 hover:bg-white/70"
                  }`}
                >
                  <menu.Icon className="h-4 w-4 shrink-0" />
                  <span>{menu.label}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        <section className="app-page-density app-page-typography space-y-2 overflow-visible lg:h-full lg:overflow-hidden">
          <Outlet />
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-white p-1.5 shadow-[0_-1px_2px_rgba(15,23,42,0.05)] lg:hidden">
        <div className="flex w-full gap-1">
          {adminMenu.map((menu) => {
            const isActive =
              location.pathname === menu.route ||
              location.pathname.startsWith(`${menu.route}/`);
            return (
              <Link
                key={menu.id}
                to={menu.route}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] leading-tight transition ${
                  isActive
                    ? "bg-[#e8f2ff] text-[#163a63]"
                    : "text-foreground/75 hover:bg-white/80"
                }`}
              >
                <menu.Icon className="h-4 w-4" />
                <span className="text-center">{menu.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
