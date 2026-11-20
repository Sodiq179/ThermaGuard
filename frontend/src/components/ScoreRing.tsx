interface ScoreRingProps {
  score: number;
  color: string;
  label: string;
  size?: number;
}

/** Circular 0–100 gauge with the score in the centre. */
export function ScoreRing({ score, color, label, size = 168 }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Draw a 270° arc, open at the bottom.
  const arc = c * 0.75;
  const filled = arc * (clamped / 100);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Attention score ${Math.round(clamped)} of 100, ${label}`}
        className="rotate-[135deg]"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.2,0,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {Math.round(clamped)}
        </span>
        <span className="mt-0.5 text-xs font-medium uppercase tracking-wider text-slate-400">of 100</span>
        <span className="mt-1 text-sm font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
    </div>
  );
}
