import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { tryExecute } from "@umbraco-cms/backoffice/resources";
import { EstimateService } from "../api/sdk.gen.js";
import type { AiUsagePeriodModel, EstimateResponseModel } from "../api/types.gen.js";
import { toAICarbonEstimateError, type AICarbonEstimateError } from "./estimate-error.js";

export interface AICarbonEstimateRequest {
    from: Date;
    to: Date;
    /** Omit to let the server pick; `alignedWindow` always supplies it. */
    granularity?: AiUsagePeriodModel;
}

export interface AICarbonEstimateResult {
    data?: EstimateResponseModel;
    error?: AICarbonEstimateError;
}

/** Server data source for the estimate endpoint. */
export class AICarbonEstimateServerDataSource {
    #host: UmbControllerHost;

    constructor(host: UmbControllerHost) {
        this.#host = host;
    }

    async requestEstimate(
        { from, to, granularity }: AICarbonEstimateRequest,
        signal?: AbortSignal,
    ): Promise<AICarbonEstimateResult> {
        // Notifications are off: the view owns the error and forbidden states (with Retry).
        const { data, error } = await tryExecute(
            this.#host,
            EstimateService.getEstimate({
                query: { from: from.toISOString(), to: to.toISOString(), granularity },
                signal,
            }),
            { disableNotifications: true, abortSignal: signal },
        );

        if (error || !data) {
            return { error: toAICarbonEstimateError(
                    error ?? { message: "The estimate response was empty." },
                    signal,
                ) };
        }

        return { data };
    }
}
