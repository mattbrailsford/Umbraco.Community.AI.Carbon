import { UMB_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/workspace";
import type { Observable } from "@umbraco-cms/backoffice/external/rxjs";

/**
 * The range picked in Umbraco.AI's Analytics header. Umbraco.AI does not export its workspace context token, so
 * this file is the one place that knows its shape: an observable `dateRange` of `{ range, compare? }` on the
 * workspace context. Everything else in the package reads `AnalyticsDateRange`.
 */
export interface AnalyticsDateRange {
    range: { from: string; to: string; preset?: string };
    /** Kept for a later comparison feature; nothing reads it yet. */
    compare?: { mode: string; from: string; to: string };
}

/** The name used in the warning when the header's range cannot be read. */
export const ANALYTICS_WORKSPACE_CONTEXT_NAME = "Umbraco.AI analytics workspace context (UmbWorkspaceContext with a dateRange observable)";

export type AnalyticsWorkspaceContext = { dateRange: Observable<unknown> };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isIsoDate = (value: unknown): value is string => typeof value === "string" && ISO_DATE.test(value);

/** True when the workspace context has the `dateRange` observable Umbraco.AI's analytics workspace provides. */
export function hasAnalyticsDateRange(
    context: typeof UMB_WORKSPACE_CONTEXT.TYPE | undefined,
): context is typeof UMB_WORKSPACE_CONTEXT.TYPE & AnalyticsWorkspaceContext {
    const dateRange = (context as { dateRange?: { subscribe?: unknown } } | undefined)?.dateRange;
    return typeof dateRange?.subscribe === "function";
}

/** Reads one emitted value of `dateRange`, or undefined when it does not have the expected shape. */
export function toAnalyticsDateRange(value: unknown): AnalyticsDateRange | undefined {
    const { range, compare } = (value ?? {}) as { range?: Record<string, unknown>; compare?: Record<string, unknown> };
    if (!isIsoDate(range?.from) || !isIsoDate(range?.to)) return undefined;
    return {
        range: { from: range.from, to: range.to, preset: typeof range.preset === "string" ? range.preset : undefined },
        compare:
            compare && isIsoDate(compare.from) && isIsoDate(compare.to)
                ? { mode: String(compare.mode), from: compare.from, to: compare.to }
                : undefined,
    };
}
