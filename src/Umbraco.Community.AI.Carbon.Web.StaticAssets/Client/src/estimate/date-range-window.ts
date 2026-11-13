import type { AiUsagePeriod } from "../api/types.gen.js";

/** A range of whole local calendar days as ISO dates (`YYYY-MM-DD`), both included. */
export interface LocalDateRange {
    from: string;
    to: string;
}

export interface EstimateWindow {
    from: Date;
    to: Date;
    granularity: AiUsagePeriod;
    /** The zone the window's day edges are in, which the server needs to count Daily buckets on the same days. */
    timeZone: string;
}

/** The longest range, in days, that gets hourly buckets. Same rule as Umbraco.AI's group-by options for a range. */
const MAX_HOURLY_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The zone the viewer is in, which is the zone Umbraco.AI's own Usage tab sends with its range. */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const parseIso = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return { year, month, day };
};

const utcMidnightOf = (iso: string): number => {
    const { year, month, day } = parseIso(iso);
    return Date.UTC(year, month - 1, day);
};

/** The zone's offset from UTC at an instant, in milliseconds. */
function offsetAt(instantMs: number, timeZone: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(new Date(instantMs));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
    const wallAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/** The local ISO date an instant falls on in the zone. */
export function localIsoDate(instant: Date, timeZone: string = browserTimeZone()): string {
    return new Date(instant.getTime() + offsetAt(instant.getTime(), timeZone)).toISOString().slice(0, 10);
}

/**
 * The UTC instant a local day starts at. Same rule as Umbraco.AI's `LocalDayStartUtc`: a day whose midnight
 * does not exist (clocks change at midnight) starts at the first time that does, and one whose midnight happens
 * twice starts at the first of them.
 */
export function localDayStart(iso: string, timeZone: string = browserTimeZone()): Date {
    const wall = utcMidnightOf(iso);
    const before = offsetAt(wall - DAY_MS, timeZone);
    const after = offsetAt(wall + DAY_MS, timeZone);
    const candidates = [wall - before, wall - after].filter((t) => offsetAt(t, timeZone) === wall - t);
    // No candidate is a gap: the day starts when the clock jumps, which is the instant the old offset reads as midnight.
    return new Date(candidates.length > 0 ? Math.min(...candidates) : wall - before);
}

const addDays = (iso: string, days: number): string => new Date(utcMidnightOf(iso) + days * DAY_MS).toISOString().slice(0, 10);

const inclusiveDays = ({ from, to }: LocalDateRange): number => Math.round((utcMidnightOf(to) - utcMidnightOf(from)) / DAY_MS) + 1;

/**
 * The request window for a range picked in Umbraco.AI's header: from the start of the first local day up to, and
 * not including, the start of the day after the last one. For Hourly ranges that is exactly the window Umbraco.AI's
 * Usage tab reads (`AIUsageOverviewService`). Daily ranges send the same window plus the zone, and the server
 * counts its daily buckets on that zone's local days the way the Usage tab does, so the figures cover the same
 * requests there too. Ranges of two days or fewer get hourly buckets, longer ones daily.
 */
export function windowForDateRange(range: LocalDateRange, timeZone: string = browserTimeZone()): EstimateWindow {
    return {
        from: localDayStart(range.from, timeZone),
        to: localDayStart(addDays(range.to, 1), timeZone),
        granularity: inclusiveDays(range) <= MAX_HOURLY_DAYS ? "Hourly" : "Daily",
        timeZone,
    };
}
