import type { EstimateRangeModel } from "../api/types.gen.js";
import { ENGLISH_NUMBER_FORMAT } from "./format-count.js";
import { NO_VALUE } from "./no-value.js";

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
 * - The central figure is the midpoint of the range, "≈ 60 g CO2e". It always uses the range's unit
 *   (chosen from the max), so a headline and its range never disagree ("≈ 0.9 g" above "0.5–1.3 g").
 *   It has no "≈" when the ends read the same (min === max), for zero, or for "—".
 * - Zero is "0 g CO2e" / "0 Wh". Non-finite input (NaN, Infinity) shows "—"; negative input is
 *   clamped to 0, since an estimate can't be below zero.
 */

const RANGE_SEPARATOR = "–";
const APPROXIMATELY = "≈";
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

/** What differs between CO2e and energy: units, the zero unit, and text appended to the unit label. */
interface Kind {
    units: readonly Unit[];
    zeroUnit: string;
    suffix: string;
}

const CO2E_KIND: Kind = { units: CO2E_UNITS, zeroUnit: "g", suffix: " CO2e" };
const ENERGY_KIND: Kind = { units: ENERGY_UNITS, zeroUnit: "Wh", suffix: "" };

/** A range as its number part and unit part, e.g. "1.2–8.4" and "g CO2e". `unit` is empty when there is no value ("—"). */
export interface FormattedRange {
    value: string;
    unit: string;
}

/** A friendly headline figure plus its range, e.g. "≈ 60 g CO2e" and "48–77 g CO2e". */
export interface Figure {
    /** The central figure as number and unit, e.g. "≈ 60" and "g CO2e". */
    central: FormattedRange;
    /** The central figure as one string, e.g. "≈ 60 g CO2e". */
    centralText: string;
    /** The "min–max unit" text, or empty when the ends read the same (the central figure already says it all). */
    range: string;
}

export function formatCo2eFigure(range: EstimateRangeModel): Figure {
    return buildFigure(range, CO2E_KIND);
}

export function formatEnergyFigure(range: EstimateRangeModel): Figure {
    return buildFigure(range, ENERGY_KIND);
}

/** The midpoint of a range as one rounded figure, e.g. "≈ 60" and "g CO2e", in the same unit as the range. */
export function formatCentral(range: EstimateRangeModel, kind: "co2e" | "energy"): FormattedRange {
    return buildFigure(range, kind === "co2e" ? CO2E_KIND : ENERGY_KIND).central;
}

function buildFigure(range: EstimateRangeModel, kind: Kind): Figure {
    const parts = layoutRange(range, kind.units, kind.zeroUnit);
    const central = layoutCentral(range, kind.units, kind.zeroUnit);
    const withSuffix = (p: FormattedRange): FormattedRange => (p.unit ? { ...p, unit: `${p.unit}${kind.suffix}` } : p);
    const centralParts = withSuffix(central);
    return {
        central: centralParts,
        centralText: joinParts(centralParts),
        range: parts.collapsed ? "" : joinParts(withSuffix(parts)),
    };
}

function layoutCentral(range: EstimateRangeModel, units: readonly Unit[], zeroUnit: string): FormattedRange {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) return { value: NO_VALUE, unit: "" };

    const min = Math.max(0, range.min);
    const max = Math.max(0, range.max);
    if (max === 0) return { value: "0", unit: zeroUnit };

    const unit = pickUnit(max, units);
    const value = formatNumber((min + max) / 2 / unit.size);
    return { value: min === max ? value : `${APPROXIMATELY} ${value}`, unit: unit.label };
}

export function formatCo2eRangeParts(range: EstimateRangeModel): FormattedRange {
    const { value, unit } = layoutRange(range, CO2E_UNITS, "g");
    return unit ? { value, unit: `${unit}${CO2E_KIND.suffix}` } : { value, unit };
}

export function formatCo2eRange(range: EstimateRangeModel): string {
    return joinParts(formatCo2eRangeParts(range));
}

/** A CO2e unit shared by a whole chart axis, so every tick reads in the same unit. */
export interface Co2eAxisUnit {
    label: string;
    /** How many grams make one of this unit. */
    size: number;
}

/** The unit for a series: the one `formatCo2eRange` would pick for the series' largest value. */
export function co2eAxisUnit(maxGrams: number): Co2eAxisUnit {
    const max = Number.isFinite(maxGrams) ? Math.max(0, maxGrams) : 0;
    const { label, size } = pickUnit(max, CO2E_UNITS);
    return { label, size };
}

/** A CO2e value in grams as a plain number in the given axis unit (no unit label), e.g. 1,200 g in kg is "1.2". */
export function formatCo2eAxisValue(grams: number, unit: Co2eAxisUnit): string {
    if (!Number.isFinite(grams)) return NO_VALUE;
    // toPrecision removes floating-point noise from chart tick values (0.30000000000000004).
    return ENGLISH_NUMBER_FORMAT.format(Number((Math.max(0, grams) / unit.size).toPrecision(6)));
}

export function formatEnergyRangeParts(range: EstimateRangeModel): FormattedRange {
    const { value, unit } = layoutRange(range, ENERGY_UNITS, "Wh");
    return { value, unit };
}

export function formatEnergyRange(range: EstimateRangeModel): string {
    return joinParts(formatEnergyRangeParts(range));
}

function joinParts({ value, unit }: FormattedRange): string {
    return unit ? `${value} ${unit}` : value;
}

/** A laid-out range; `collapsed` is true when both ends read the same, so `value` is a single number. */
interface LaidOutRange extends FormattedRange {
    collapsed: boolean;
}

function layoutRange(range: EstimateRangeModel, units: readonly Unit[], zeroUnit: string): LaidOutRange {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) return { value: NO_VALUE, unit: "", collapsed: true };

    const minValue = Math.max(0, range.min);
    const maxValue = Math.max(0, range.max);
    if (maxValue === 0 && minValue === 0) return { value: "0", unit: zeroUnit, collapsed: true };

    const unit = pickUnit(maxValue, units);
    const min = formatNumber(minValue / unit.size);
    const max = formatNumber(maxValue / unit.size);
    return {
        value: min === max ? max : `${min}${RANGE_SEPARATOR}${max}`,
        unit: unit.label,
        collapsed: min === max,
    };
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
