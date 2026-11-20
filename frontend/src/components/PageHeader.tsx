import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  accent?: string;
  meta?: ReactNode;
}

export function PageHeader({ title, subtitle, crumbs, actions, accent, meta }: PageHeaderProps) {
  return (
    <header className="mb-6 sm:mb-8">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" aria-hidden />}
                {c.to ? (
                  <Link to={c.to} className="rounded hover:text-slate-900 dark:hover:text-white">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="font-medium text-slate-700 dark:text-slate-200">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-stretch gap-4">
          {accent && <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500 sm:text-base dark:text-slate-400">{subtitle}</p>}
            {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
