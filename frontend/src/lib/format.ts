import type { AttentionLevel, BandKey, Intensity, WorkerStatus } from "../api/types";

export const TZ = "Asia/Riyadh";

const isMissing = (v: number | null | undefined): v is null | undefined =>
  v === null || v === undefined || Number.isNaN(v);

export function fmtTemp(v: number | null | undefined, digits = 1): string {
  return isMissing(v) ? "—" : `${v.toFixed(digits)} °C`;
}

export function fmtNum(v: number | null | undefined, digits = 1): string {
  return isMissing(v) ? "—" : v.toFixed(digits);
}

export function fmtPct(v: number | null | undefined): string {
  return isMissing(v) ? "—" : `${Math.round(v)}%`;
}

/** 72 -> "1 h 12 min", 45 -> "45 min", 120 -> "2 h". */
export function fmtMinutes(v: number | null | undefined): string {
  if (isMissing(v)) return "—";
  const total = Math.max(0, Math.round(v));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Time in Asia/Riyadh as HH:mm. */
export function fmtTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? timeFmt.format(d) : "—";
}

export function fmtDateTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? `${dateFmt.format(d)}, ${timeFmt.format(d)}` : "—";
}

/** "just now", "3 min ago", "2 h ago". */
export function fmtAgo(v: string | null | undefined, now: number = Date.now()): string {
  const d = toDate(v);
  if (!d) return "never";
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

export function fmtTrend(v: number | null | undefined): string {
  if (isMissing(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  return `${sign}${Math.abs(v).toFixed(1)} °C / 10 min`;
}

export const INTENSITY_LABEL: Record<Intensity, string> = { light: "Light", moderate: "Moderate", heavy: "Heavy" };
export const INTENSITIES: Intensity[] = ["light", "moderate", "heavy"];
export const STATUS_LABEL: Record<WorkerStatus, string> = { working: "Working", break: "On break", off: "Off site" };

export const BAND_COLOR: Record<BandKey, string> = {
  low: "#16a34a",
  moderate: "#ca8a04",
  high: "#ea580c",
  very_high: "#dc2626",
  extreme: "#7e22ce",
};

export const ATTENTION_ORDER: Record<AttentionLevel, number> = { normal: 0, watch: 1, attention: 2, act_now: 3 };

export const ATTENTION_COLOR: Record<AttentionLevel, string> = {
  normal: "#10b981",
  watch: "#f59e0b",
  attention: "#f97316",
  act_now: "#dc2626",
};
