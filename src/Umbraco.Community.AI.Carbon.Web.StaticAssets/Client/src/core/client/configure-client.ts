import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import type { UmbElement } from "@umbraco-cms/backoffice/element-api";

/**
 * Configures the generated hey-api client for authenticated calls to the Umbraco backoffice
 * Management API. Delegates to `authContext.configureClient(client)`, which sets `baseUrl`,
 * `credentials: 'include'`, an auth callback gating each request on a ready access token, and the
 * default response interceptors (401 retry, error normalization, server notifications).
 */
export function configureAICarbonClient(host: UmbElement, client: unknown): Promise<void> {
    return new Promise<void>((resolve) => {
        host.consumeContext(UMB_AUTH_CONTEXT, (authContext) => {
            if (!authContext) return;
            authContext.configureClient(client as never);
            resolve();
        });
    });
}
