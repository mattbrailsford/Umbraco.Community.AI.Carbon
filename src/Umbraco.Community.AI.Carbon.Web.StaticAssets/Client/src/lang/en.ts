import type { UmbLocalizationDictionary } from "@umbraco-cms/backoffice/localization-api";

// Keys resolve as `aiCarbon_<key>`. Read them with `localize.termOrDefault`: `term()` returns the
// key itself on a miss, which would leak raw keys into the UI.
export default {
    aiCarbon: {
        tabLabel: "CO2",
        headline: "Estimated CO2 emissions",
        range_label: "Time range",
        range_last24h: "Last 24 hours",
        range_last7d: "Last 7 days",
        range_last30d: "Last 30 days",
        card_co2e_label: "Estimated CO2e",
        card_co2e_description: "Estimated emissions as a low-to-high range.",
        card_energy_label: "Estimated energy",
        card_energy_description: "Estimated energy used as a low-to-high range.",
        card_requests_label: "Requests estimated",
        card_requests_description: "Successful chat requests included in the estimate.",
        card_notEstimated_label: "Models not estimated",
        card_notEstimated_description: "Models with no estimate data, so not counted.",
        loadFailed: "The estimate could not be loaded.",
        forbidden: "You need access to the AI section to see this.",
    },
} as UmbLocalizationDictionary;
