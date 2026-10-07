import { AICARBON_METHOD_PANEL_MODAL_ALIAS } from "./method-panel-modal.token.js";

export const manifests: Array<UmbExtensionManifest> = [
    {
        type: "modal",
        alias: AICARBON_METHOD_PANEL_MODAL_ALIAS,
        name: "Umbraco AI Carbon Method Panel Modal",
        element: () => import("./method-panel-modal.element.js"),
    },
];
