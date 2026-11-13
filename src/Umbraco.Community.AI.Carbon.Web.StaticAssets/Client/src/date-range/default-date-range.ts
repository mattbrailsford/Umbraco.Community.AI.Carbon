import { localIsoDate } from "../estimate/date-range-window.js";
import type { AnalyticsDateRange } from "./analytics-date-range.guard.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Umbraco.AI's own default: the last 7 days, counted back from today in the viewer's zone. */
export function defaultAnalyticsDateRange(now: Date = new Date(), timeZone?: string): AnalyticsDateRange {
    const to = localIsoDate(now, timeZone);
    const from = new Date(new Date(`${to}T00:00:00Z`).getTime() - 6 * DAY_MS).toISOString().slice(0, 10);
    return { range: { from, to, preset: "last-7-days" } };
}
