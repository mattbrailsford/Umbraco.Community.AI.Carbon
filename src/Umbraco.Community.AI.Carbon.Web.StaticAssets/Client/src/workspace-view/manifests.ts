import { UMB_WORKSPACE_CONDITION_ALIAS } from "@umbraco-cms/backoffice/workspace";
import { UMBRACO_AI_ANALYTICS_ROOT_WORKSPACE_ALIAS } from "./constants.js";

export const manifests: Array<UmbExtensionManifest> = [
    {
        type: "workspaceView",
        alias: "AICarbon.WorkspaceView.AnalyticsRoot.CO2",
        name: "Umbraco AI Carbon Analytics Workspace View",
        element: () => import("./workspace-view.element.js"),
        // Higher weight sorts first; Umbraco.AI's "Dashboard" view is 1000, so this sits after it.
        weight: 900,
        meta: {
            label: "#aiCarbon_tabLabel",
            pathname: "co2",
            icon: "icon-cloud",
        },
        conditions: [
            {
                alias: UMB_WORKSPACE_CONDITION_ALIAS,
                match: UMBRACO_AI_ANALYTICS_ROOT_WORKSPACE_ALIAS,
            },
        ],
    },
];
