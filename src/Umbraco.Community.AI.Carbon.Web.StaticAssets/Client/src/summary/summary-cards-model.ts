import type { EstimateResponseModel } from "../api/types.gen.js";
import { formatCo2eFigure, formatEnergyFigure, type Figure } from "../estimate/format-co2.js";
import { formatCount } from "../estimate/format-count.js";

export type SummaryCardKind = "co2e" | "energy" | "requests" | "notEstimated";

export interface SummaryCardModel {
    kind: SummaryCardKind;
    icon: string;
    /** The headline figure, e.g. "≈ 60" (the midpoint of the range for CO2e and energy). */
    value: string;
    /** Its unit, e.g. "g CO2e"; empty for counts and for "—". */
    unit: string;
    /** The low-to-high range as small text, e.g. "48–77 g CO2e"; empty for counts and when the ends read the same. */
    range: string;
    /** Uses the warning colour. */
    warning: boolean;
}

/** Turns an estimate into the four summary cards. Pure, so it can be tested without rendering. */
export function buildSummaryCards(estimate: EstimateResponseModel): SummaryCardModel[] {
    const notEstimatedModels = estimate.notEstimated.models;
    return [
        { kind: "co2e", icon: "icon-cloud", ...fromFigure(formatCo2eFigure(estimate.total.co2eGrams)), warning: false },
        { kind: "energy", icon: "icon-flash", ...fromFigure(formatEnergyFigure(estimate.total.energyWh)), warning: false },
        {
            kind: "requests",
            icon: "icon-activity",
            value: formatCount(estimate.total.requests),
            unit: "",
            range: "",
            warning: false,
        },
        {
            kind: "notEstimated",
            icon: "icon-alert",
            value: formatCount(notEstimatedModels),
            unit: "",
            range: "",
            warning: notEstimatedModels > 0,
        },
    ];
}

function fromFigure({ central, range }: Figure): Pick<SummaryCardModel, "value" | "unit" | "range"> {
    return { value: central.value, unit: central.unit, range };
}
