import type { EstimateResponseModel } from "../api/types.gen.js";
import { formatCo2eRangeParts, formatEnergyRangeParts } from "../estimate/format-co2.js";
import { formatCount } from "../estimate/format-count.js";

export type SummaryCardKind = "co2e" | "energy" | "requests" | "notEstimated";

export interface SummaryCardModel {
    kind: SummaryCardKind;
    icon: string;
    /** The figure, e.g. "48–77". */
    value: string;
    /** Its unit, e.g. "g CO2e"; empty for counts and for "—". */
    unit: string;
    /** Uses the warning colour. */
    warning: boolean;
}

/** Turns an estimate into the four summary cards. Pure, so it can be tested without rendering. */
export function buildSummaryCards(estimate: EstimateResponseModel): SummaryCardModel[] {
    const notEstimatedModels = estimate.notEstimated.models;
    return [
        { kind: "co2e", icon: "icon-cloud", ...formatCo2eRangeParts(estimate.total.co2eGrams), warning: false },
        { kind: "energy", icon: "icon-flash", ...formatEnergyRangeParts(estimate.total.energyWh), warning: false },
        { kind: "requests", icon: "icon-activity", value: formatCount(estimate.total.requests), unit: "", warning: false },
        {
            kind: "notEstimated",
            icon: "icon-alert",
            value: formatCount(notEstimatedModels),
            unit: "",
            warning: notEstimatedModels > 0,
        },
    ];
}
