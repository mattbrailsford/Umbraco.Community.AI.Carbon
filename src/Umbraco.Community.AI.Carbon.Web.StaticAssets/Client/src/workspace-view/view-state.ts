import type { EstimateResponseModel } from "../api/types.gen.js";

export type ViewState = "loading" | "content" | "empty" | "analyticsDisabled" | "error" | "forbidden";

export interface ViewStateInput {
    estimate?: Pick<EstimateResponseModel, "total" | "notEstimated"> & {
        method: Pick<EstimateResponseModel["method"], "analyticsEnabled">;
    };
    /** Accepted for symmetry with the view's state; a reload keeps its figures, so it doesn't change the body. */
    loading?: boolean;
    /** HTTP status of the failed request; pass 0 when it failed without one (e.g. offline). */
    errorStatus?: number;
}

/** Decides which body the CO2 tab shows. The header is shown in every state. */
export function selectViewState({ estimate, errorStatus }: ViewStateInput): ViewState {
    if (errorStatus !== undefined) return errorStatus === 403 ? "forbidden" : "error";
    // No figures and no error: the first load is on its way.
    if (!estimate) return "loading";
    // Whole-view message: with analytics off there is nothing to estimate, so it wins over "empty".
    if (!estimate.method.analyticsEnabled) return "analyticsDisabled";
    // Not-estimated usage still counts as content so those rows are visible.
    const hasUsage = estimate.total.requests > 0 || estimate.notEstimated.requests > 0;
    return hasUsage ? "content" : "empty";
}
