import type { EstimateRangeModel } from "../api/types.gen.js";

/**
 * Formats estimate ranges for display, e.g. "1.2–8.4 g CO2e" or "1.4–2.4 kWh".
 *
 * Rules (same for CO2e and energy):
 * - One unit is chosen from the larger end (max), and both ends are shown in that unit, so a range
 *   never mixes units ("12–84 mg", never "12 mg–0.084 g").
 * - CO2e: mg when max < 1 g, g below 1,000 g, kg from 1,000 g. There is no unit below mg, so very
 *   small values stay in mg with decimals (0.0005 g shows as "0.5 mg").
 * - Energy: Wh below 1,000 Wh, kWh from 1,000 Wh. There is no unit below Wh (0.05 Wh shows as "0.05 Wh").
 * - Numbers show two significant figures below 100 and whole numbers from 100 up, with trailing
 *   zeros dropped. Decimals are capped at six places, so a tiny min next to a large max can show as 0.
 * - If both ends read the same once rounded (including min === max), a single value is shown.
 * - Zero is "0 g CO2e" / "0 Wh".
 */

const RANGE_SEPARATOR = "–";
const MAX_DECIMALS = 6;

interface Unit {
    label: string;
    /** How many base units (g or Wh) make one of this unit. */
    size: number;
}

const CO2E_UNITS: readonly Unit[] = [
    { label: "mg", size: 0.001 },
    { label: "g", size: 1 },
    { label: "kg", size: 1000 },
];

const ENERGY_UNITS: readonly Unit[] = [
    { label: "Wh", size: 1 },
    { label: "kWh", size: 1000 },
];

export function formatCo2eRange(range: EstimateRangeModel): string {
    return `${formatRange(range, CO2E_UNITS, "g")} CO2e`;
}

export function formatEnergyRange(range: EstimateRangeModel): string {
    return formatRange(range, ENERGY_UNITS, "Wh");
}

function formatRange(range: EstimateRangeModel, units: readonly Unit[], zeroUnit: string): string {
    if (range.max === 0 && range.min === 0) return `0 ${zeroUnit}`;

    const unit = pickUnit(range.max, units);
    const min = formatNumber(range.min / unit.size);
    const max = formatNumber(range.max / unit.size);
    const value = min === max ? max : `${min}${RANGE_SEPARATOR}${max}`;
    return `${value} ${unit.label}`;
}

/** Largest unit that the max end reaches; the smallest unit when it reaches none. */
function pickUnit(max: number, units: readonly Unit[]): Unit {
    let picked = units[0];
    for (const unit of units) {
        if (max >= unit.size) picked = unit;
    }
    return picked;
}

function formatNumber(value: number): string {
    if (value === 0) return "0";
    const decimals = value >= 10 ? 0 : value >= 1 ? 1 : Math.ceil(-Math.log10(value)) + 1;
    const fixed = value.toFixed(Math.min(decimals, MAX_DECIMALS));
    return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}
