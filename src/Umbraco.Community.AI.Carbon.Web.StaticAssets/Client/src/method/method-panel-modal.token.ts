import { UmbModalToken } from "@umbraco-cms/backoffice/modal";
import type { EstimateMethodModel } from "../api/types.gen.js";

export interface AICarbonMethodPanelModalData {
    method: EstimateMethodModel;
}

export const AICARBON_METHOD_PANEL_MODAL_ALIAS = "AICarbon.Modal.MethodPanel";

export const AICARBON_METHOD_PANEL_MODAL = new UmbModalToken<AICarbonMethodPanelModalData, never>(
    AICARBON_METHOD_PANEL_MODAL_ALIAS,
    {
        modal: {
            type: "sidebar",
            size: "small",
        },
    },
);
