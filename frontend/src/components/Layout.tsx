import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { Bell, BookOpen, Cpu, LayoutDashboard, Menu, Moon, Settings2, Sun, Users, X } from "lucide-react";
import { useAlerts, useOverview } from "../api/hooks";
import { useLiveUpdates, type LiveStatus } from "../api/ws";
import { useTheme } from "../lib/theme";
import { TZ } from "../lib/format";
import { Logo } from "./Logo";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/workers", label: "Workers", icon: Users },
  { to: "/alerts", label: "Alerts", icon: Bell, badge: true },
  { to: "/simulator", label: "Simulator", icon: Cpu },
  { to: "/admin", label: "Admin", icon: Settings2 },
  { to: "/methodology", label: "How it works", icon: BookOpen },
] as const;

function titleFor(path: string): string {
  if (path.startsWith("/zones/")) return "Zone";
  if (path.startsWith("/workers/")) return "Worker";
  const hit = NAV.find((n) => (n.to === "/" ? path === "/" : path.startsWith(n.to)));
  return hit?.label ?? "ThermaGuard";
}

function NavItems({ onNavigate, alertCount }: { onNavigate?: () => void; alertCount: number }) {
  return (
    <ul className="space-y-1">
      {NAV.map((n) => {
        const Icon = n.icon;
        return (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={"end" in n ? n.end : false}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  "group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white",
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1">{n.label}</span>
              {"badge" in n && alertCount > 0 && (
                <span
                  className="tnum min-w-[22px] rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white"
                  aria-label={`${alertCount} open alerts`}
                >
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

function LiveDot({ status }: { status: LiveStatus }) {
  const live = status === "live";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        live
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
      )}
      role="status"
    >
      <span className="relative flex h-2 w-2">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={clsx("relative inline-flex h-2 w-2 rounded-full", live ? "bg-emerald-500" : "bg-amber-500")} />
      </span>
      {live ? "Live" : status === "connecting" ? "Connecting" : "Reconnecting"}
    </span>
  );
}

const clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="tnum hidden text-sm text-slate-500 sm:inline dark:text-slate-400" title="Local time (Asia/Riyadh)">
      {clockFmt.format(now)} <span className="text-slate-400 dark:text-slate-500">AST</span>
    </span>
  );
}

export function Layout() {
  const live = useLiveUpdates();
  const { dark, toggle } = useTheme();
  const alerts = useAlerts(true);
  const overview = useOverview();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const alertCount = alerts.data?.length ?? 0;
  const siteName = overview.data?.site.name;

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    document.title = `${titleFor(location.pathname)} · ThermaGuard`;
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white px-4 py-5 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="px-3 pb-6">
          <Logo />
        </div>
        <nav aria-label="Main">
          <NavItems alertCount={alertCount} />
        </nav>
        <div className="mt-auto rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          Decision support for supervisors. Not a medical device.
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-toast-in flex-col bg-white px-4 py-5 shadow-lift dark:bg-slate-900">
            <div className="flex items-center justify-between px-3 pb-6">
              <Logo />
              <button type="button" className="icon-btn" aria-label="Close navigation" onClick={() => setDrawer(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Main">
              <NavItems alertCount={alertCount} onNavigate={() => setDrawer(false)} />
            </nav>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" className="icon-btn -ml-2 lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{titleFor(location.pathname)}</p>
              {siteName && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{siteName}</p>}
            </div>
            <Clock />
            <LiveDot status={live} />
            <button
              type="button"
              className="icon-btn"
              onClick={toggle}
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
