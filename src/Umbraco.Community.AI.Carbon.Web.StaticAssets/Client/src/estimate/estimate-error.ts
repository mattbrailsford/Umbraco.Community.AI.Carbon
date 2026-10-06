export interface AICarbonEstimateError {
    /** HTTP status when the server answered, otherwise undefined (e.g. connection lost). */
    status?: number;
    /** True for 403: the user lacks access to the AI section. */
    isForbidden: boolean;
    message: string;
    /** True when the request was cancelled by the caller; drop the result instead of showing an error. */
    isAborted: boolean;
}

export const toAICarbonEstimateError = (error: unknown, signal?: AbortSignal): AICarbonEstimateError => {
    const candidate = (error ?? {}) as {
        status?: unknown;
        name?: unknown;
        message?: unknown;
        title?: unknown;
        problemDetails?: { status?: unknown };
    };
    const rawStatus = candidate.status ?? candidate.problemDetails?.status;
    const status = typeof rawStatus === "number" && rawStatus > 0 ? rawStatus : undefined;
    const rawMessage = candidate.message ?? candidate.title;
    return {
        status,
        isForbidden: status === 403,
        isAborted: signal?.aborted === true || candidate.name === "AbortError",
        message: typeof rawMessage === "string" && rawMessage.length > 0 ? rawMessage : "The estimate request failed.",
    };
};
