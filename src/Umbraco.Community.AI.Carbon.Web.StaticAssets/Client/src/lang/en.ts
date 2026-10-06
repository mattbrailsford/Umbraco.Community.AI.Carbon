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
        byFeature_headline: "By feature",
        byFeature_feature: "Feature",
        byFeature_requests: "Requests",
        byFeature_co2e: "Estimated CO2e",
        byFeature_switchedOff: "Feature breakdown is switched off in Umbraco.AI analytics settings.",
        feature_agent: "Agents",
        feature_prompt: "Prompts",
        "feature_inline-chat": "Inline chat",
        "feature_inline-agent": "Inline agents",
        feature_other: "Other",
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
        trend_headline: "Over time",
        trend_axis: "{unit} CO2e",
        trend_hourly: "hourly",
        trend_daily: "daily",
        trend_summary:
            "Estimated CO2e over time, {bucket} from {from} to {to}. The highest period is up to {high}.",
        method_button: "How is this calculated?",
        method_headline: "How is this calculated?",
        method_counted_headline: "What is counted",
        method_counted:
            "The output tokens of text generation (chat), and the number of successful chat requests.",
        method_notCounted_headline: "What is not counted",
        method_notCounted:
            "Input tokens, embeddings, image generation, speech, model training, the network and your own devices. Models EcoLogits doesn't know are listed as not estimated.",
        method_how_headline: "How the estimate is made",
        method_how:
            "Using EcoLogits' method, the GPU and server energy is worked out for each model based on its size (number of parameters). That is multiplied by the data centre's efficiency (PUE) and the CO2e per kWh of the electricity mix, and a share of the hardware's manufacturing footprint is added.",
        method_howCap:
            "EcoLogits normally limits the modelled generation time to how long each request actually took. Umbraco.AI does not record each request's duration, so that limit is not applied here. It rarely changes the result, and leaving it out can only make the estimate higher, not lower.",
        method_zone_headline: "Electricity zone",
        method_zoneOverride: "Zone used: {zone}. This is set by you with AICarbon:ElectricityZone.",
        method_zoneShared:
            "Zone used: {zone}. This is the default for the data centres of the models that were estimated.",
        method_zoneMixed:
            "Each model uses its provider's default data centre location, so more than one zone was used:",
        method_zoneNone: "No models were estimated, so no electricity zone was used.",
        method_zoneHow:
            'If you know where your AI provider runs the models (for example an Azure region in Sweden), set AICarbon:ElectricityZone in appsettings.json to that country\'s code, for example "SWE". Only set it to where the models really run.',
        method_ranges_headline: "Why the ranges are wide",
        method_ranges:
            "Ranges are widest for closed models, whose sizes are not published, so their size is estimated.",
        method_credit_headline: "Credit",
        method_credit:
            "Figures use EcoLogits (data version {dataVersion}), licensed under MPL-2.0. EcoLogits is part of the CodeCarbon non-profit and was started by GenAI Impact.",
        method_notice:
            "This is an unofficial community package. It is not made or endorsed by Umbraco HQ. The figures are estimates, not claims by Umbraco.",
        loadFailed: "The estimate could not be loaded.",
        forbidden: "You need access to the AI section to see this.",
    },
} as UmbLocalizationDictionary;
