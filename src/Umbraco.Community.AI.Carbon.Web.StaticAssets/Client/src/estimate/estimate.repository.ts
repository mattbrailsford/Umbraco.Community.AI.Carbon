import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UmbRepositoryBase } from "@umbraco-cms/backoffice/repository";
import {
    AICarbonEstimateServerDataSource,
    type AICarbonEstimateRequest,
    type AICarbonEstimateResult,
} from "./estimate.server.data-source.js";

export class AICarbonEstimateRepository extends UmbRepositoryBase {
    #dataSource: AICarbonEstimateServerDataSource;

    constructor(host: UmbControllerHost) {
        super(host);
        this.#dataSource = new AICarbonEstimateServerDataSource(host);
    }

    /** Pass a `signal` to cancel a stale request, e.g. when the date range changes. */
    requestEstimate(request: AICarbonEstimateRequest, signal?: AbortSignal): Promise<AICarbonEstimateResult> {
        return this.#dataSource.requestEstimate(request, signal);
    }
}
