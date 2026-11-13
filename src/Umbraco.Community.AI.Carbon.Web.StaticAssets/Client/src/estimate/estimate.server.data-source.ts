import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { tryExecute } from "@umbraco-cms/backoffice/resources";
import { EstimateService } from "../api/sdk.gen.js";
import type { AiUsagePeriod, EstimateResponseModel } from "../api/types.gen.js";
import { toAICarbonEstimateError, type AICarbonEstimateError } from "./estimate-error.js";

export interface AICarbonEstimateRequest {
    from: Date;
    to: Date;
    /** Omit to let the server pick; `windowForDateRange` always supplies it. */
    granularity?: AiUsagePeriod;
    /** The viewer's IANA time zone: Daily buckets are the days of this zone. `windowForDateRange` supplies it. */
    timeZone: string;
}

export interface AICarbonEstimateResult {
    data?: EstimateResponseModel;
    error?: AICarbonEstimateError;
    /** The zone the server counted Daily buckets in: the zone sent, or `UTC` once the server could not resolve it. */
    timeZone?: string;
}

/**
 * Set once the server answers 400 for the time zone, for the rest of the session: later requests leave it out
 * and get UTC days, so they do not fail first every time.
 */
let serverLacksTimeZone = false;

/** Forgets that the server rejected the time zone. For tests. @internal */
export function resetTimeZoneFallback(): void {
    serverLacksTimeZone = false;
}

/** Server data source for the estimate endpoint. */
export class AICarbonEstimateServerDataSource {
    #host: UmbControllerHost;

    constructor(host: UmbControllerHost) {
        this.#host = host;
    }

    async requestEstimate(request: AICarbonEstimateRequest, signal?: AbortSignal): Promise<AICarbonEstimateResult> {
        if (serverLacksTimeZone) return this.#send(request, undefined, signal);

        const result = await this.#send(request, request.timeZone, signal);
        if (!result.error || result.error.status !== 400 || !result.error.invalidFields.includes("timezone")) return result;

        // A host without the zone (no IANA data, or a zone id it lacks) rejects it; without one the server returns UTC days.
        console.warn(`The server does not know the time zone "${request.timeZone}"; Daily figures will use UTC days.`);
        serverLacksTimeZone = true;
        return this.#send(request, undefined, signal);
    }

    async #send(
        { from, to, granularity }: AICarbonEstimateRequest,
        timeZone: string | undefined,
        signal?: AbortSignal,
    ): Promise<AICarbonEstimateResult> {
        // Notifications are off: the view owns the error and forbidden states (with Retry).
        const { data, error } = await tryExecute(
            this.#host,
            EstimateService.getEstimate({
                query: { from: from.toISOString(), to: to.toISOString(), granularity, timeZone },
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

        return { data, timeZone: timeZone ?? "UTC" };
    }
}
