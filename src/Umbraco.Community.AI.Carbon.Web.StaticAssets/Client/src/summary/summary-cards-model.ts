import type { EstimateRangeModel, EstimateResponseModel } from "../api/types.gen.js";
import { formatCo2eFigure, formatCo2eRangeParts, formatEnergyFigure, formatEnergyRangeParts, type Figure } from "../estimate/format-co2.js";
import { formatCount } from "../estimate/format-count.js";

export type SummaryCardKind = "co2e" | "energy" | "requests" | "notEstimated";

export interface SummaryCardModel {
    kind: SummaryCardKind;
    icon: string;
    /** The headline figure as the tile shows it, unit included, e.g. "≈ 60 g CO2e" (the midpoint of the range for CO2e and energy). Unset without an estimate. */
    value?: string;
    /** The low-to-high range without its unit (the value line carries it), e.g. "48–77"; empty for counts and when the ends read the same. */
    range: string;
    /**
     * The tile's number for comparing periods: the range midpoint in base units (g, Wh) or the count; unset when it
     * can't be shown. A compare `previous` goes beside it, on the same scale.
     */
    current?: number;
    /** True when the estimate has this figure but it can't be computed (not a finite number), so the tile says "no data" rather than a bare dash. Never set without an estimate. */
    noData: boolean;
    /** Tints the tile: only "models not estimated" sets it, "warning" above 0 and neutral at 0. */
    status?: "warning" | "default";
}

const CARDS: ReadonlyArray<Pick<SummaryCardModel, "kind" | "icon">> = [
    { kind: "co2e", icon: "icon-cloud" },
    { kind: "energy", icon: "icon-flash" },
    { kind: "requests", icon: "icon-activity" },
    { kind: "notEstimated", icon: "icon-alert" },
];

/**
 * Turns an estimate into the four summary cards. Pure, so it can be tested without rendering. Without an estimate
 * (loading, or failed) it still lists the four cards, with no figures, so the view can draw them as skeletons or error dashes.
 */
export function buildSummaryCards(estimate?: EstimateResponseModel): SummaryCardModel[] {
    if (!estimate) return CARDS.map((card) => ({ ...card, range: "", noData: false }));
    const notEstimatedModels = estimate.notEstimated.models;
    const cards: Array<Omit<SummaryCardModel, "noData">> = [
        {
            ...CARDS[0],
            ...fromFigure(formatCo2eFigure(estimate.total.co2eGrams), formatCo2eRangeParts(estimate.total.co2eGrams).value),
            current: midpoint(estimate.total.co2eGrams),
        },
        {
            ...CARDS[1],
            ...fromFigure(formatEnergyFigure(estimate.total.energyWh), formatEnergyRangeParts(estimate.total.energyWh).value),
            current: midpoint(estimate.total.energyWh),
        },
        {
            ...CARDS[2],
            value: formatCount(estimate.total.requests),
            range: "",
            current: estimate.total.requests,
        },
        {
            ...CARDS[3],
            value: formatCount(notEstimatedModels),
            range: "",
            current: notEstimatedModels,
            status: notEstimatedModels > 0 ? "warning" : "default",
        },
    ];
    return cards.map((card) => ({ ...card, noData: !Number.isFinite(card.current) }));
}

/** `rangeNumbers` is the range without its unit; the figure's own `range` is empty when the ends read the same. */
function fromFigure({ centralText, range }: Figure, rangeNumbers: string): Pick<SummaryCardModel, "value" | "range"> {
    return { value: centralText, range: range ? rangeNumbers : "" };
}

function midpoint({ min, max }: EstimateRangeModel): number | undefined {
    return Number.isFinite(min) && Number.isFinite(max) ? (Math.max(0, min) + Math.max(0, max)) / 2 : undefined;
}
