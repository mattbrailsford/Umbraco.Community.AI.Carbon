import type { UmbEntryPointOnInit, UmbEntryPointOnUnload } from "@umbraco-cms/backoffice/extension-api";

export * from "./index.js";

export const onInit: UmbEntryPointOnInit = (_host, _extensionRegistry) => {};

export const onUnload: UmbEntryPointOnUnload = (_host, _extensionRegistry) => {};
