import { useState } from "react";
import clsx from "clsx";
import { BellOff, History } from "lucide-react";
import { useAlerts } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { AlertItem } from "../components/AlertItem";
import { EmptyState, ErrorState, Skeleton } from "../components/States";

type Tab = "active" | "history";

export function AlertsPage() {
  const [tab, setTab] = useState<Tab>("active");
  const { data, isLoading, error, refetch } = useAlerts(tab === "active", 200);
  const tabs: { key: Tab; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "history", label: "History" },
  ];

  return (
    <div>
      <PageHeader title="Alerts" subtitle="Acknowledge to show you've seen it; resolve once handled" />
      <Card>
        <div role="tablist" aria-label="Alert views" className="flex gap-1 border-b border-slate-100 px-4 dark:border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "-mb-px border-b-2 px-4 py-3.5 text-sm font-medium transition",
                tab === t.key
                  ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              {t.label}
              {t.key === "active" && tab === "active" && data && (
                <span className="tnum ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{data.length}</span>
              )}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="px-5 sm:px-6">
          {isLoading ? (
            <div className="space-y-4 py-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} className="my-5" />
          ) : !data || data.length === 0 ? (
            <EmptyState
              icon={tab === "active" ? <BellOff className="h-6 w-6" /> : <History className="h-6 w-6" />}
              title={tab === "active" ? "No active alerts" : "No alert history"}
              message={tab === "active" ? "Conditions are within guidance across the site." : "Resolved alerts will appear here."}
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((a) => (
                <AlertItem key={a.id} alert={a} actions />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
