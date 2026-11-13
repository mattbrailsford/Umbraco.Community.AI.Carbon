import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { formatCo2eRange } from "../estimate/format-co2.js";
import type { LocalizeWithDefault } from "../estimate/warning-text.js";

/*
 * Buckets are shown in the viewer's local time zone. Hourly buckets are UTC hour starts and Daily buckets
 * are the start of a local day (the request sends the viewer's zone), so both are real instants that convert
 * cleanly. Formatters are built per call so they follow the zone in force at that moment. When the server could
 * not resolve the viewer's zone its Daily buckets are UTC days, so Daily labels take `dayTimeZone` (`UTC`) instead.
 */

const LOCALE = "en-GB";

/** Date part, in the viewer's zone. */
function dateFormat(withYear: boolean, timeZone?: string): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(LOCALE, {
        ...(timeZone ? { timeZone } : {}),
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
    });
}

function hourFormat(): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** Short x-axis label: "1 Oct" for Daily, "1 Oct 14:00" (local time) for Hourly. */
export function formatBucketLabel(timestamp: string, granularity: AiUsagePeriod, dayTimeZone?: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    const day = dateFormat(false, granularity === "Daily" ? dayTimeZone : undefined).format(date);
    return granularity === "Hourly" ? `${day} ${hourFormat().format(date)}` : day;
}

/** Full tooltip heading: "1 Oct 2026" for Daily, "1 Oct 2026, 14:00" (local time) for Hourly. */
export function formatBucketTitle(timestamp: string, granularity: AiUsagePeriod, dayTimeZone?: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    const day = dateFormat(true, granularity === "Daily" ? dayTimeZone : undefined).format(date);
    return granularity === "Hourly" ? `${day}, ${hourFormat().format(date)}` : day;
}

/** The calendar day of an instant as an ISO date ("2026-10-31"), in `timeZone` (the viewer's when unset). Empty when it isn't a date. */
export function formatIsoDay(timestamp: string | number | Date, timeZone?: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", { ...(timeZone ? { timeZone } : {}), year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * The index of the bucket that contains `now`, or undefined when none does. Daily: the bucket for today's day in the
 * zone the days were counted in (`dayTimeZone`, the viewer's when unset). Hourly: the bucket whose hour it is.
 */
export function incompleteBucketIndex(labels: readonly string[], granularity: AiUsagePeriod, now: Date, dayTimeZone?: string): number | undefined {
    const at = now.getTime();
    const index =
        granularity === "Hourly"
            ? labels.findIndex((label) => {
                  const start = new Date(label).getTime();
                  return at >= start && at < start + 3_600_000;
              })
            : labels.findIndex((label) => formatIsoDay(label, dayTimeZone) === formatIsoDay(now, dayTimeZone));
    return index < 0 ? undefined : index;
}

/**
 * One-sentence text description of the series for screen readers: the period, the bucket size and
 * the highest value. Empty when there are no points.
 */
export function describeTrend(
    points: readonly EstimateTimeSeriesPointModel[],
    granularity: AiUsagePeriod,
    localize: LocalizeWithDefault = (_key, fallback) => fallback,
    comparePoints?: readonly EstimateTimeSeriesPointModel[],
    dayTimeZone?: string,
): string {
    if (points.length === 0) return "";
    const first = points[0];
    const last = points[points.length - 1];
    const peak = points.reduce((max, p) => Math.max(max, p.co2eGrams.max), 0);
    const bucket = granularity === "Hourly"
        ? localize("aiCarbon_trend_hourly", "hourly")
        : localize("aiCarbon_trend_daily", "daily");
    const summary = localize(
        "aiCarbon_trend_summary",
        "Estimated CO2e over time, {bucket} from {from} to {to}, shown as range bars with a middle line. The highest period is up to {high}.",
    )
        .replace("{bucket}", bucket)
        .replace("{from}", formatBucketTitle(first.timestamp, granularity, dayTimeZone))
        .replace("{to}", formatBucketTitle(last.timestamp, granularity, dayTimeZone))
        .replace("{high}", formatCo2eRange({ min: peak, max: peak }));
    if (!comparePoints || comparePoints.length === 0) return summary;
    // The comparison's own dates, since the line is the other period's figures lined up under this one's days.
    return (
        summary +
        localize("aiCarbon_trend_summaryComparison", " Compared with {from} to {to}.")
            .replace("{from}", formatBucketTitle(comparePoints[0].timestamp, granularity, dayTimeZone))
            .replace("{to}", formatBucketTitle(comparePoints[comparePoints.length - 1].timestamp, granularity, dayTimeZone))
    );
}
