import type { EstimateRangeModel } from "../api/types.gen.js";
import { ENGLISH_NUMBER_FORMAT } from "./format-count.js";

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
 * - If rounding lifts the max to the next unit's size, the next unit is used (999.96 g shows as
 *   "1 kg", never "1000 g").
 * - Numbers use the shared English style (thousands separators, e.g. "1,200 kg").
 * - Zero is "0 g CO2e" / "0 Wh". Non-finite input (NaN, Infinity) shows "–"; negative input is
 *   clamped to 0, since an estimate can't be below zero.
 */

const RANGE_SEPARATOR = "–";
const NOT_A_NUMBER = "–";
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
    const formatted = formatRange(range, CO2E_UNITS, "g");
    return formatted === NOT_A_NUMBER ? formatted : `${formatted} CO2e`;
}

export function formatEnergyRange(range: EstimateRangeModel): string {
    return formatRange(range, ENERGY_UNITS, "Wh");
}

function formatRange(range: EstimateRangeModel, units: readonly Unit[], zeroUnit: string): string {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) return NOT_A_NUMBER;

    const minValue = Math.max(0, range.min);
    const maxValue = Math.max(0, range.max);
    if (maxValue === 0 && minValue === 0) return `0 ${zeroUnit}`;

    const unit = pickUnit(maxValue, units);
    const min = formatNumber(minValue / unit.size);
    const max = formatNumber(maxValue / unit.size);
    const value = min === max ? max : `${min}${RANGE_SEPARATOR}${max}`;
    return `${value} ${unit.label}`;
}

/**
 * Largest unit that the max end reaches (the smallest when it reaches none), moved up one more
 * when rounding the max for display would reach the next unit's size.
 */
function pickUnit(max: number, units: readonly Unit[]): Unit {
    let index = 0;
    units.forEach((unit, i) => {
        if (max >= unit.size) index = i;
    });
    const next = units[index + 1];
    if (next && roundForDisplay(max / units[index].size) * units[index].size >= next.size) return next;
    return units[index];
}

function decimalsFor(value: number): number {
    const decimals = value >= 10 ? 0 : value >= 1 ? 1 : Math.ceil(-Math.log10(value)) + 1;
    return Math.min(decimals, MAX_DECIMALS);
}

function roundForDisplay(value: number): number {
    return value === 0 ? 0 : Number(value.toFixed(decimalsFor(value)));
}

function formatNumber(value: number): string {
    return ENGLISH_NUMBER_FORMAT.format(roundForDisplay(value));
}
