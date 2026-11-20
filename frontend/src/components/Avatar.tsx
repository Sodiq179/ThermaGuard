import { useState } from "react";
import clsx from "clsx";
import type { WorkerStatus } from "../api/types";

/** Photo URLs that already failed, so we don't re-request them on every render. */
const missingPhotos = new Set<string>();

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const STATUS_DOT: Record<WorkerStatus, { cls: string; label: string }> = {
  working: { cls: "bg-emerald-500", label: "Working" },
  break: { cls: "bg-sky-500", label: "On break" },
  off: { cls: "bg-slate-400", label: "Off site" },
};

interface AvatarProps {
  id: string;
  name: string;
  size?: number;
  status?: WorkerStatus;
  square?: boolean;
  className?: string;
}

/** Worker photo from /avatars/{id}.jpg, falling back to initials. */
export function Avatar({ id, name, size = 32, status, square = false, className }: AvatarProps) {
  const src = `/avatars/${encodeURIComponent(id)}.jpg`;
  const [failed, setFailed] = useState(() => missingPhotos.has(src));
  const radius = square ? "rounded-md" : "rounded-full";
  const dot = Math.max(6, Math.round(size * 0.22));

  return (
    <span className={clsx("relative inline-block shrink-0", className)} style={{ width: size, height: size }} title={name}>
      {failed ? (
        <span
          role="img"
          aria-label={name}
          className={clsx(
            "flex h-full w-full select-none items-center justify-center bg-slate-100 font-medium text-slate-600 ring-1 ring-inset ring-black/5 dark:bg-slate-800 dark:text-slate-300 dark:ring-white/5",
            radius,
          )}
          style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {initials(name)}
        </span>
      ) : (
        <img
          src={src}
          alt={name}
          className={clsx("h-full w-full bg-slate-100 object-cover ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10", radius)}
          onError={() => {
            missingPhotos.add(src);
            setFailed(true);
          }}
        />
      )}
      {status && (
        <span
          className={clsx("absolute -bottom-px -right-px rounded-full ring-2 ring-white dark:ring-[#12151C]", STATUS_DOT[status].cls)}
          style={{ width: dot, height: dot }}
          title={STATUS_DOT[status].label}
        />
      )}
    </span>
  );
}

interface StackProps {
  workers: { id: string; name: string }[];
  max?: number;
  size?: number;
}

export function AvatarStack({ workers, max = 4, size = 24 }: StackProps) {
  const shown = workers.slice(0, max);
  const extra = workers.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((w) => (
        <span key={w.id} className="rounded-full ring-2 ring-white dark:ring-[#12151C]">
          <Avatar id={w.id} name={w.name} size={size} />
        </span>
      ))}
      {extra > 0 && <span className="tnum pl-2.5 text-[12px] text-slate-500 dark:text-slate-400">+{extra}</span>}
    </span>
  );
}
