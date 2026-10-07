import type { UmbEntryPointOnInit, UmbEntryPointOnUnload } from "@umbraco-cms/backoffice/extension-api";
import { client } from "./api/client.gen.js";
import { configureAICarbonClient } from "./core/client/index.js";

export * from "./index.js";

export const onInit: UmbEntryPointOnInit = (host, _extensionRegistry) => {
    configureAICarbonClient(host, client);
};

export const onUnload: UmbEntryPointOnUnload = (_host, _extensionRegistry) => {};
