// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.
//
// Ported from EcoLogits 0.11.2 ecologits/tracers/utils.py (PROVIDER_CONFIG_MAP).
// Source: https://github.com/mlco2/ecologits/blob/0.11.2/ecologits/tracers/utils.py

namespace Umbraco.Community.AI.Carbon.Core.EcoLogits;

/// <summary>
/// EcoLogits' per-provider data centre assumptions (zone, PUE, WUE).
/// </summary>
internal static class EcoLogitsProviderConfigs
{
    /// <summary>Gets the config for each provider, keyed by EcoLogits provider key.</summary>
    public static IReadOnlyDictionary<string, EcoLogitsProviderConfig> All { get; } =
        new Dictionary<string, EcoLogitsProviderConfig>(StringComparer.OrdinalIgnoreCase)
        {
            ["anthropic"] = new("USA", new RangeValue(1.09, 1.14), new RangeValue(0.13, 0.999)),
            ["cohere"] = new("USA", RangeValue.Of(1.09), RangeValue.Of(0.999)),
            ["google_genai"] = new("USA", RangeValue.Of(1.09), RangeValue.Of(0.999)),
            ["huggingface_hub"] = new("USA", new RangeValue(1.09, 1.14), new RangeValue(0.13, 0.99)),
            ["mistralai"] = new("SWE", RangeValue.Of(1.16), RangeValue.Of(0.09)),
            ["openai"] = new("USA", RangeValue.Of(1.20), RangeValue.Of(0.569)),
        };
}
