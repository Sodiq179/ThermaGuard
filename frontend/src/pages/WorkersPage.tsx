import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import type { AttentionLevel } from "../api/types";
import { useWorkers, useZones } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { WorkerTable, sortFlaggedFirst } from "../components/WorkerTable";
import { EmptyState, ErrorState, Skeleton } from "../components/States";

const LEVELS: { value: AttentionLevel | "all"; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "act_now", label: "Act now" },
  { value: "attention", label: "Attention" },
  { value: "watch", label: "Watch" },
  { value: "normal", label: "Normal" },
];

export function WorkersPage() {
  const workers = useWorkers();
  const zones = useZones();
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("all");
  const [level, setLevel] = useState<AttentionLevel | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (workers.data ?? []).filter(
      (w) =>
        (zone === "all" || (zone === "none" ? !w.zone_id : w.zone_id === zone)) &&
        (level === "all" || w.attention.level === level) &&
        (!q || `${w.name} ${w.id} ${w.trade}`.toLowerCase().includes(q)),
    );
    return sortFlaggedFirst(list);
  }, [workers.data, query, zone, level]);

  return (
    <div>
      <PageHeader title="Workers" subtitle="Everyone registered on site, flagged first" />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5 dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search by name, ID or trade"
              aria-label="Search workers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <select className="input sm:w-48" aria-label="Filter by zone" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="all">All zones</option>
              {(zones.data ?? []).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
              <option value="none">Not checked in</option>
            </select>
            <select
              className="input sm:w-44"
              aria-label="Filter by attention level"
              value={level}
              onChange={(e) => setLevel(e.target.value as AttentionLevel | "all")}
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {workers.isLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : workers.error ? (
          <ErrorState error={workers.error} onRetry={() => void workers.refetch()} className="m-5" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={workers.data?.length ? "No matching workers" : "No workers registered"}
            message={workers.data?.length ? "Try a different search or filter." : "Add workers in Admin."}
          />
        ) : (
          <>
            <WorkerTable workers={filtered} showZone />
            <p className="tnum border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">
              Showing {filtered.length} of {workers.data?.length ?? 0} workers
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
