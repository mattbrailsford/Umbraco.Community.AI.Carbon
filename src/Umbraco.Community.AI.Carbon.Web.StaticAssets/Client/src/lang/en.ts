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
        byModel_headline: "By model",
        byModel_model: "Model",
        byModel_matchedAs: "Matched as",
        byModel_zone: "Zone",
        byModel_requests: "Requests",
        byModel_outputTokens: "Output tokens",
        byModel_co2e: "Estimated CO2e",
        byModel_status: "Status",
        status_estimated: "Estimated",
        status_unknownModel: "Not estimated (unknown model)",
        status_unsupported: "Not estimated (not supported)",
        "warning_model-arch-not-released":
            "This model's size isn't published, so its size is estimated and the range is wide.",
        "warning_model-arch-multimodal":
            "This is a multimodal model, so the estimate is less precise (it is based on text output only).",
        "warning_electricity-mix-wue-world":
            "No water-use data for this electricity zone, so a world average was used for water.",
        "warning_electricity-mix-adpe-world":
            "No resource-depletion data for this electricity zone, so a world average was used.",
        "warning_electricity-mix-pe-world":
            "No primary-energy data for this electricity zone, so a world average was used.",
        "warning_invalid-model-data": "The reference data for this model is invalid, so it could not be estimated.",
        "warning_missing-provider-data": "There is no reference data for this provider, so it could not be estimated.",
        loadFailed: "The estimate could not be loaded.",
        forbidden: "You need access to the AI section to see this.",
    },
} as UmbLocalizationDictionary;
