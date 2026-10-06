import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { formatCo2eRange } from "../estimate/format-co2.js";
import type { LocalizeWithDefault } from "../estimate/warning-text.js";

/*
 * All times are shown in UTC, because the API's buckets are UTC hours and days: a bucket then reads
 * the same for every viewer and a "day" is never split across two local dates. The tooltip says "UTC".
 */

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const HOUR = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const FULL_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Short x-axis label: "1 Oct" for Daily, "1 Oct 14:00" for Hourly. */
export function formatBucketLabel(timestamp: string, granularity: AiUsagePeriod): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return granularity === "Hourly" ? `${DAY.format(date)} ${HOUR.format(date)}` : DAY.format(date);
}

/** Full tooltip heading: "1 Oct 2026" for Daily, "1 Oct 2026, 14:00 UTC" for Hourly. */
export function formatBucketTitle(timestamp: string, granularity: AiUsagePeriod): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return granularity === "Hourly" ? `${FULL_DAY.format(date)}, ${HOUR.format(date)} UTC` : FULL_DAY.format(date);
}

/**
 * One-sentence text description of the series for screen readers: the period, the bucket size and
 * the highest value. Empty when there are no points.
 */
export function describeTrend(
    points: readonly EstimateTimeSeriesPointModel[],
    granularity: AiUsagePeriod,
    localize: LocalizeWithDefault = (_key, fallback) => fallback,
): string {
    if (points.length === 0) return "";
    const first = points[0];
    const last = points[points.length - 1];
    const peak = points.reduce((max, p) => Math.max(max, p.co2eGrams.max), 0);
    const bucket = granularity === "Hourly"
        ? localize("aiCarbon_trend_hourly", "hourly")
        : localize("aiCarbon_trend_daily", "daily");
    return localize(
        "aiCarbon_trend_summary",
        "Estimated CO2e over time, {bucket} from {from} to {to}. The highest period is up to {high}.",
    )
        .replace("{bucket}", bucket)
        .replace("{from}", formatBucketTitle(first.timestamp, granularity))
        .replace("{to}", formatBucketTitle(last.timestamp, granularity))
        .replace("{high}", formatCo2eRange({ min: peak, max: peak }));
}
