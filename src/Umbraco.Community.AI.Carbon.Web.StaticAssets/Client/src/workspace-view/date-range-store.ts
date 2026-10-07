import type { EstimateRange } from "../estimate/index.js";

const STORAGE_KEY = "aicarbon.dateRange";
const DEFAULT_RANGE: EstimateRange = "last7d";
const KNOWN_RANGES: ReadonlyArray<EstimateRange> = ["last24h", "last7d", "last30d"];

const isEstimateRange = (value: unknown): value is EstimateRange =>
    KNOWN_RANGES.some((range) => range === value);

/** The range the user last picked, or "Last 7 days" if none, unknown, or storage is unavailable. */
export function loadDateRange(): EstimateRange {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isEstimateRange(stored) ? stored : DEFAULT_RANGE;
    } catch {
        // Storage can be blocked (privacy mode, policy); remembering the range is a nicety only.
        return DEFAULT_RANGE;
    }
}

export function saveDateRange(range: EstimateRange): void {
    try {
        localStorage.setItem(STORAGE_KEY, range);
    } catch {
        // See loadDateRange: failing to remember must never break the view.
    }
}
