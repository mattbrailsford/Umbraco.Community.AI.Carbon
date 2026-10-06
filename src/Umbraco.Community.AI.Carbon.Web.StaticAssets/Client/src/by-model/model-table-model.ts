import type { AiCarbonEstimateStatus, EstimateModelRowModel } from "../api/types.gen.js";
import { formatCo2eRange } from "../estimate/format-co2.js";
import { formatCount } from "../estimate/format-count.js";

/** Shown in a cell that has no value (no CO2e figure, no match, no zone). */
export const EMPTY_CELL = "—";

export interface ModelRowViewModel {
    /** providerId + modelId + status: one pair can give an estimated row and an unsupported one. */
    key: string;
    providerId: string;
    modelId: string;
    matchedAs: string;
    zone: string;
    requests: string;
    outputTokens: string;
    co2e: string;
    status: AiCarbonEstimateStatus;
    /** Raw warning codes; the element turns them into text. */
    warnings: readonly string[];
}

/** Turns API rows into display rows, in the API's order. Pure, so it can be tested without rendering. */
export function buildModelRows(rows: readonly EstimateModelRowModel[]): ModelRowViewModel[] {
    return rows.map((row) => ({
        key: `${row.providerId}|${row.modelId}|${row.status}`,
        providerId: row.providerId,
        modelId: row.modelId,
        matchedAs: row.matchedAs || EMPTY_CELL,
        zone: row.electricityZone || EMPTY_CELL,
        requests: formatCount(row.requests),
        outputTokens: formatCount(row.outputTokens),
        co2e: row.co2eGrams ? formatCo2eRange(row.co2eGrams) : EMPTY_CELL,
        status: row.status,
        warnings: row.warnings ?? [],
    }));
}
