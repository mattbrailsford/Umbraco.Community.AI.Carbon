import type { EstimateRangeModel, EstimateResponseModel } from "../api/types.gen.js";
import { formatCo2eFigure, formatCo2eRangeParts, formatEnergyFigure, formatEnergyRangeParts, type Figure } from "../estimate/format-co2.js";
import { formatCount } from "../estimate/format-count.js";

export type SummaryCardKind = "co2e" | "energy" | "requests" | "notEstimated";

export interface SummaryCardModel {
    kind: SummaryCardKind;
    icon: string;
    /** The headline figure as the tile shows it, unit included, e.g. "≈ 60 g CO2e" (the midpoint of the range for CO2e and energy). */
    value: string;
    /** The low-to-high range without its unit (the value line carries it), e.g. "48–77"; empty for counts and when the ends read the same. */
    range: string;
    /**
     * The tile's number for comparing periods: the range midpoint in base units (g, Wh) or the count; unset when it
     * can't be shown. A compare `previous` goes beside it, on the same scale.
     */
    current?: number;
    /** Tints the tile: only "models not estimated" sets it, "warning" above 0 and neutral at 0. */
    status?: "warning" | "default";
}

/** Turns an estimate into the four summary cards. Pure, so it can be tested without rendering. */
export function buildSummaryCards(estimate: EstimateResponseModel): SummaryCardModel[] {
    const notEstimatedModels = estimate.notEstimated.models;
    return [
        {
            kind: "co2e",
            icon: "icon-cloud",
            ...fromFigure(formatCo2eFigure(estimate.total.co2eGrams), formatCo2eRangeParts(estimate.total.co2eGrams).value),
            current: midpoint(estimate.total.co2eGrams),
        },
        {
            kind: "energy",
            icon: "icon-flash",
            ...fromFigure(formatEnergyFigure(estimate.total.energyWh), formatEnergyRangeParts(estimate.total.energyWh).value),
            current: midpoint(estimate.total.energyWh),
        },
        {
            kind: "requests",
            icon: "icon-activity",
            value: formatCount(estimate.total.requests),
            range: "",
            current: estimate.total.requests,
        },
        {
            kind: "notEstimated",
            icon: "icon-alert",
            value: formatCount(notEstimatedModels),
            range: "",
            current: notEstimatedModels,
            status: notEstimatedModels > 0 ? "warning" : "default",
        },
    ];
}

/** `rangeNumbers` is the range without its unit; the figure's own `range` is empty when the ends read the same. */
function fromFigure({ centralText, range }: Figure, rangeNumbers: string): Pick<SummaryCardModel, "value" | "range"> {
    return { value: centralText, range: range ? rangeNumbers : "" };
}

function midpoint({ min, max }: EstimateRangeModel): number | undefined {
    return Number.isFinite(min) && Number.isFinite(max) ? (Math.max(0, min) + Math.max(0, max)) / 2 : undefined;
}
