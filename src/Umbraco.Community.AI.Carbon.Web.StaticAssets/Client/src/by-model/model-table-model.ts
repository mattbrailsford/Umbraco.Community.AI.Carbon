import type { UauiTableColumn } from "@umbraco/analytics-ui";
import { UAUI_TABLE_CELL } from "@umbraco/analytics-ui";
import type { AiCarbonEstimateStatus, EstimateModelRowModel } from "../api/types.gen.js";
import { NO_VALUE } from "../estimate/no-value.js";
import { CO2E_CELL, type Co2eColumnOptions } from "../co2e-cell/co2e-cell.name.js";
import { MISSING_TEXT_CELL } from "../missing-text-cell/missing-text-cell.name.js";
import { formatCo2eFigure } from "../estimate/format-co2.js";
import { rangeMidpoint } from "../estimate/range-midpoint.js";
import type { LocalizeWithDefault } from "../estimate/warning-text.js";

export type ModelRowUsage = "chat" | "other";

/** The fields that identify a row (the table's `row-key`), so a row keeps its identity when its status changes from Estimated to UnknownModel. */
export const MODEL_ROW_KEY = ["providerId", "modelId", "usage"];

/** One row of the by-model table. It is also the row handed to `uaui-data-table`, so field names are column keys. */
export type ModelRowViewModel = {
    providerId: string;
    modelId: string;
    /** "other" for a non-chat row (unsupported capability), else "chat": a model can have one of each, with the same provider and model. */
    usage: ModelRowUsage;
    /** Undefined when there is none: the table sorts it last, and the cell shows "—". */
    matchedAs?: string;
    zone?: string;
    requests: number;
    outputTokens: number;
    /** The headline figure with its unit, e.g. "≈ 5 g CO2e"; "—" when the row has no estimate. */
    co2e: string;
    /** The range as small text, e.g. "1.2–8.4 g CO2e"; empty when there is none or the ends read the same. */
    co2eRange: string;
    /** The middle of the range in grams, for sorting; undefined for a row with no estimate, which sorts last. */
    co2eMid?: number;
    status: AiCarbonEstimateStatus;
    /** Raw warning codes; the CO2e cell turns them into text. */
    warnings: readonly string[];
};

/** The column the table starts sorted by: the estimate's midpoint, biggest first. */
export const MODEL_TABLE_DEFAULT_SORT = { key: "co2eMid", direction: "desc" } as const;

/** Turns API rows into table rows, in the API's order. Pure, so it can be tested without rendering. */
export function buildModelRows(rows: readonly EstimateModelRowModel[]): ModelRowViewModel[] {
    return rows.map((row) => {
        const figure = row.co2eGrams ? formatCo2eFigure(row.co2eGrams) : undefined;
        return {
            providerId: row.providerId,
            modelId: row.modelId,
            usage: row.status === "UnsupportedCapability" ? "other" : "chat",
            matchedAs: row.matchedAs || undefined,
            zone: row.electricityZone || undefined,
            requests: row.requests,
            outputTokens: row.outputTokens,
            co2e: figure ? figure.centralText : NO_VALUE,
            co2eRange: figure?.range ?? "",
            co2eMid: row.co2eGrams ? rangeMidpoint(row.co2eGrams) : undefined,
            status: row.status,
            warnings: row.warnings ?? [],
        };
    });
}

/**
 * The table's columns. There is no status column: a row with no estimate says so in its CO2e cell.
 * Search covers the text columns only (the model's second line, the provider, counts as the model's text).
 */
export function buildModelColumns(t: LocalizeWithDefault): UauiTableColumn[] {
    // Rows here can carry warnings, so the CO2e column reserves room for the icon in every row.
    const co2eColumn: UauiTableColumn & Co2eColumnOptions = {
        key: MODEL_TABLE_DEFAULT_SORT.key,
        label: t("aiCarbon_byModel_co2e", "Estimated CO2e"),
        elementName: CO2E_CELL,
        align: "end",
        sortable: true,
        sortAs: "number",
        reserveWarningSpace: true,
    };
    return [
        {
            key: "modelId",
            label: t("aiCarbon_byModel_model", "Model"),
            elementName: UAUI_TABLE_CELL.text,
            meta: { secondaryKey: "providerId" },
            searchable: true,
            sortable: true,
        },
        {
            key: "matchedAs",
            label: t("aiCarbon_byModel_matchedAs", "Matched As"),
            elementName: MISSING_TEXT_CELL,
            searchable: true,
            sortable: true,
        },
        {
            key: "zone",
            label: t("aiCarbon_byModel_zone", "Zone"),
            elementName: MISSING_TEXT_CELL,
            searchable: true,
            sortable: true,
        },
        {
            key: "requests",
            label: t("aiCarbon_byModel_requests", "Requests"),
            elementName: UAUI_TABLE_CELL.number,
            align: "end",
            sortable: true,
            sortAs: "number",
        },
        {
            key: "outputTokens",
            label: t("aiCarbon_byModel_outputTokens", "Output Tokens"),
            elementName: UAUI_TABLE_CELL.number,
            align: "end",
            sortable: true,
            sortAs: "number",
        },
        co2eColumn,
    ];
}
