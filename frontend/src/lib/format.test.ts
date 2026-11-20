import { describe, expect, it } from "vitest";
import { fmtAgo, fmtMinutes, fmtTemp, fmtTime, fmtTrend } from "./format";

describe("format", () => {
  it("formats temperatures with one decimal", () => {
    expect(fmtTemp(31.26)).toBe("31.3 °C");
    expect(fmtTemp(null)).toBe("—");
  });

  it("formats minutes as hours and minutes", () => {
    expect(fmtMinutes(72)).toBe("1 h 12 min");
    expect(fmtMinutes(45)).toBe("45 min");
    expect(fmtMinutes(120)).toBe("2 h");
    expect(fmtMinutes(undefined)).toBe("—");
  });

  it("formats times in Asia/Riyadh", () => {
    expect(fmtTime("2026-07-01T09:05:00Z")).toBe("12:05");
    expect(fmtTime("not a date")).toBe("—");
  });

  it("formats trends and relative times", () => {
    expect(fmtTrend(0.42)).toBe("+0.4 °C / 10 min");
    expect(fmtAgo("2026-07-01T09:00:00Z", Date.parse("2026-07-01T09:03:00Z"))).toBe("3 min ago");
  });
});
