using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Resolution;

/// <summary>
/// Narrows several EcoLogits models that share a name down to the most plausible one(s).
/// </summary>
internal static class ModelCandidateSelector
{
    // The one aggregator in the EcoLogits data: third-party hosting of other vendors' open models.
    private const string AggregatorProvider = "huggingface_hub";

    // Vendor hints are the vendor names that hosting ids carry ("anthropic.", "mistralai/", "meta."), not
    // Umbraco.AI provider ids. Each maps to the EcoLogits provider that lists that vendor's models; a hint
    // that is not listed must equal an EcoLogits provider key exactly.
    private static readonly IReadOnlyDictionary<string, string> VendorAliases
        = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["openai"] = "openai",
            ["anthropic"] = "anthropic",
            ["google"] = "google_genai",
            ["gemini"] = "google_genai",
            ["mistral"] = "mistralai",
            ["mistralai"] = "mistralai",
            ["cohere"] = "cohere",
            ["meta"] = "huggingface_hub",
            ["meta-llama"] = "huggingface_hub",
        };

    /// <summary>
    /// Prefers candidates from the vendor the id named, then first-party providers over the aggregator.
    /// A preference that would leave nothing is skipped.
    /// </summary>
    /// <param name="candidates">The models sharing the name.</param>
    /// <param name="vendorHint">The vendor a stripped prefix named, if any.</param>
    /// <returns>One model when the choice is clear; several when it is still ambiguous.</returns>
    public static IReadOnlyList<EcoLogitsModel> Narrow(IReadOnlyList<EcoLogitsModel> candidates, string? vendorHint)
    {
        var narrowed = candidates;
        if (narrowed.Count > 1 && !string.IsNullOrWhiteSpace(vendorHint))
        {
            var fromVendor = narrowed.Where(model => MatchesVendor(model.Provider, vendorHint)).ToList();
            if (fromVendor.Count > 0)
            {
                narrowed = fromVendor;
            }
        }

        if (narrowed.Count > 1)
        {
            var firstParty = narrowed
                .Where(model => !string.Equals(model.Provider, AggregatorProvider, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (firstParty.Count > 0)
            {
                narrowed = firstParty;
            }
        }

        return narrowed;
    }

    private static bool MatchesVendor(string ecoLogitsProvider, string vendorHint)
    {
        var hint = vendorHint.Trim();
        var mapped = VendorAliases.GetValueOrDefault(hint) ?? hint;
        return string.Equals(ecoLogitsProvider, mapped, StringComparison.OrdinalIgnoreCase);
    }
}
