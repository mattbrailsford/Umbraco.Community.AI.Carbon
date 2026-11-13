import type { EstimateRangeModel } from "../api/types.gen.js";

/** The middle of a range, clamped at zero like the figures are; undefined when an end isn't a number. Used to sort by size. */
export function rangeMidpoint(range: EstimateRangeModel): number | undefined {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) return undefined;
    return (Math.max(0, range.min) + Math.max(0, range.max)) / 2;
}
