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
    <ul className="space-y-0.5">
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
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[14px] transition-colors",
                  isActive ? "bg-white/[0.06] font-medium text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
                )
              }
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              <span className="flex-1">{n.label}</span>
              {"badge" in n && alertCount > 0 && (
                <span
                  className="tnum text-[12px] text-slate-400"
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

function SiteCard({ name, live }: { name?: string; live: LiveStatus }) {
  const ok = live === "live";
  return (
    <div className="mt-auto border-t border-white/[0.06] px-2.5 pt-3">
      <p className="truncate text-[13px] font-medium text-slate-200">{name ?? "Site"}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-500">
        <span className={clsx("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-amber-400")} aria-hidden />
        {ok ? "Telemetry live" : "Reconnecting"} · Decision support only
      </p>
    </div>
  );
}

function LiveDot({ status }: { status: LiveStatus }) {
  const live = status === "live";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300"
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
    <span className="tnum hidden text-[12px] text-slate-500 sm:inline dark:text-slate-400" title="Local time (Asia/Riyadh)">
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/[0.06] bg-ink px-3 py-4 lg:flex">
        <div className="px-2.5 pb-6">
          <Logo inverted />
        </div>
        <nav aria-label="Main">
          <NavItems alertCount={alertCount} />
        </nav>
        <SiteCard name={siteName} live={live} />
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
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-ink px-3 py-4">
            <div className="flex items-center justify-between px-2 pb-6">
              <Logo inverted />
              <button type="button" className="icon-btn text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close navigation" onClick={() => setDrawer(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Main">
              <NavItems alertCount={alertCount} onNavigate={() => setDrawer(false)} />
            </nav>
            <SiteCard name={siteName} live={live} />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white dark:border-white/[0.08] dark:bg-slate-950">
          <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" className="icon-btn -ml-2 lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-slate-500 dark:text-slate-400">
                {siteName ?? "ThermaGuard"} <span className="text-slate-300 dark:text-slate-600">/</span>{" "}
                <span className="font-medium text-slate-900 dark:text-white">{titleFor(location.pathname)}</span>
              </p>
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
        <main id="main" className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
