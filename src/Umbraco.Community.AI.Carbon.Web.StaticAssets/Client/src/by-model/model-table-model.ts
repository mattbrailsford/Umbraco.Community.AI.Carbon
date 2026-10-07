import type { AiCarbonEstimateStatus, EstimateModelRowModel } from "../api/types.gen.js";
import { formatCo2eFigure } from "../estimate/format-co2.js";
import { formatCount } from "../estimate/format-count.js";
import { NO_VALUE } from "../estimate/no-value.js";

export interface ModelRowViewModel {
    /** providerId + modelId + status: one pair can give an estimated row and an unsupported one. */
    key: string;
    providerId: string;
    modelId: string;
    matchedAs: string;
    zone: string;
    requests: string;
    outputTokens: string;
    /** The headline figure with its unit, e.g. "≈ 5 g CO2e"; "—" when the row has no estimate. */
    co2e: string;
    /** The range as small text, e.g. "1.2–8.4 g CO2e"; empty when there is none or the ends read the same. */
    co2eRange: string;
    status: AiCarbonEstimateStatus;
    /** Raw warning codes; the element turns them into text. */
    warnings: readonly string[];
}

/** Turns API rows into display rows, in the API's order. Pure, so it can be tested without rendering. */
export function buildModelRows(rows: readonly EstimateModelRowModel[]): ModelRowViewModel[] {
    return rows.map((row) => {
        const figure = row.co2eGrams ? formatCo2eFigure(row.co2eGrams) : undefined;
        return {
            key: `${row.providerId}|${row.modelId}|${row.status}`,
            providerId: row.providerId,
            modelId: row.modelId,
            matchedAs: row.matchedAs || NO_VALUE,
            zone: row.electricityZone || NO_VALUE,
            requests: formatCount(row.requests),
            outputTokens: formatCount(row.outputTokens),
            co2e: figure ? figure.centralText : NO_VALUE,
            co2eRange: figure?.range ?? "",
            status: row.status,
            warnings: row.warnings ?? [],
        };
    });
}
