import type { UmbLocalizationDictionary } from "@umbraco-cms/backoffice/localization-api";

// Keys resolve as `aiCarbon_<key>`. Read them with `localize.termOrDefault`: `term()` returns the
// key itself on a miss, which would leak raw keys into the UI.
export default {
    aiCarbon: {
        tabLabel: "CO2",
        headline: "Estimated CO2 emissions",
        // Temporary (T13). T14 replaces this with the summary cards and unit scaling.
        totalPlaceholder: (min: string, max: string) => `${min} to ${max} g CO2e (estimated)`,
        loadFailed: "The estimate could not be loaded.",
        forbidden: "You need access to the AI section to see this.",
    },
} as UmbLocalizationDictionary;
