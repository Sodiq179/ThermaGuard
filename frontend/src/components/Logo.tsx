import { useId } from "react";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  const gradId = `tg-grad-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      <path d="M16 2 4 6.5v8.2c0 7.3 5.1 13.3 12 15.3 6.9-2 12-8 12-15.3V6.5L16 2Z" fill={`url(#${gradId})`} />
      <path
        d="M16 8.5a2.2 2.2 0 0 0-2.2 2.2v7.1a3.9 3.9 0 1 0 4.4 0v-7.1A2.2 2.2 0 0 0 16 8.5Z"
        fill="#fff"
      />
      <circle cx="16" cy="21" r="2.1" fill="#dc2626" />
      <rect x="15.2" y="13" width="1.6" height="7" rx="0.8" fill="#dc2626" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
        Therma<span className="bg-gradient-to-r from-amber-500 to-red-600 bg-clip-text text-transparent">Guard</span>
      </span>
    </span>
  );
}
