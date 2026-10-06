import type { EstimateResponseModel } from "../api/types.gen.js";
import { formatCo2eRange, formatEnergyRange } from "../estimate/format-co2.js";

export type SummaryCardKind = "co2e" | "energy" | "requests" | "notEstimated";

export interface SummaryCardModel {
    kind: SummaryCardKind;
    icon: string;
    value: string;
    /** Uses the warning colour. */
    warning: boolean;
}

/** Turns an estimate into the four summary cards. Pure, so it can be tested without rendering. */
export function buildSummaryCards(estimate: EstimateResponseModel): SummaryCardModel[] {
    const notEstimatedModels = estimate.notEstimated.models;
    return [
        { kind: "co2e", icon: "icon-cloud", value: formatCo2eRange(estimate.total.co2eGrams), warning: false },
        { kind: "energy", icon: "icon-flash", value: formatEnergyRange(estimate.total.energyWh), warning: false },
        { kind: "requests", icon: "icon-activity", value: estimate.total.requests.toLocaleString("en"), warning: false },
        { kind: "notEstimated", icon: "icon-alert", value: notEstimatedModels.toLocaleString("en"), warning: notEstimatedModels > 0 },
    ];
}
