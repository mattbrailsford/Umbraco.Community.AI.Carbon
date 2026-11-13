import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { formatCo2eRange } from "../estimate/format-co2.js";
import type { LocalizeWithDefault } from "../estimate/warning-text.js";

/*
 * Buckets are shown in the viewer's local time zone. Hourly buckets are UTC hour starts and Daily buckets
 * are the start of a local day (the request sends the viewer's zone), so both are real instants that convert
 * cleanly. Formatters are built per call so they follow the zone in force at that moment.
 */

const LOCALE = "en-GB";

/** Date part, in the viewer's zone. */
function dateFormat(withYear: boolean): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(LOCALE, {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
    });
}

function hourFormat(): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** Short x-axis label: "1 Oct" for Daily, "1 Oct 14:00" (local time) for Hourly. */
export function formatBucketLabel(timestamp: string, granularity: AiUsagePeriod): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    const day = dateFormat(false).format(date);
    return granularity === "Hourly" ? `${day} ${hourFormat().format(date)}` : day;
}

/** Full tooltip heading: "1 Oct 2026" for Daily, "1 Oct 2026, 14:00" (local time) for Hourly. */
export function formatBucketTitle(timestamp: string, granularity: AiUsagePeriod): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    const day = dateFormat(true).format(date);
    return granularity === "Hourly" ? `${day}, ${hourFormat().format(date)}` : day;
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
        "Estimated CO2e over time, {bucket} from {from} to {to}, shown as range bars with a middle line. The highest period is up to {high}.",
    )
        .replace("{bucket}", bucket)
        .replace("{from}", formatBucketTitle(first.timestamp, granularity))
        .replace("{to}", formatBucketTitle(last.timestamp, granularity))
        .replace("{high}", formatCo2eRange({ min: peak, max: peak }));
}
