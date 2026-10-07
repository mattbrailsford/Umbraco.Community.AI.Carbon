import type { AiUsagePeriod } from "../api/types.gen.js";

export type EstimateRange = "last24h" | "last7d" | "last30d";

export interface EstimateWindow {
    from: Date;
    to: Date;
    granularity: AiUsagePeriod;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const RANGES: Record<EstimateRange, { lengthMs: number; granularity: AiUsagePeriod }> = {
    last24h: { lengthMs: DAY_MS, granularity: "Hourly" },
    // An exact 7-day window is still Hourly (Umbraco.AI treats only more than 7 days as Daily).
    last7d: { lengthMs: 7 * DAY_MS, granularity: "Hourly" },
    last30d: { lengthMs: 30 * DAY_MS, granularity: "Daily" },
};

/**
 * Builds a request window whose end sits on the next UTC bucket boundary (start of the next UTC
 * hour for Hourly, next UTC midnight for Daily). The server caches results per exact window, so
 * repeat requests within the same bucket only hit the cache when the window is aligned like this.
 */
export function alignedWindow(range: EstimateRange, now: Date = new Date()): EstimateWindow {
    const { lengthMs, granularity } = RANGES[range];
    const bucketMs = granularity === "Hourly" ? HOUR_MS : DAY_MS;
    // Epoch is on a UTC hour and UTC midnight, so flooring epoch milliseconds aligns to UTC buckets.
    const to = new Date((Math.floor(now.getTime() / bucketMs) + 1) * bucketMs);
    const from = new Date(to.getTime() - lengthMs);
    return { from, to, granularity };
}
