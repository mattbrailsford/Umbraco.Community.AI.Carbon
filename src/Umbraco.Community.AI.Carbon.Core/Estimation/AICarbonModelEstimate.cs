namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The estimate (or the reason there is none) for one Umbraco.AI provider and model.
/// </summary>
/// <param name="ProviderId">The Umbraco.AI provider id.</param>
/// <param name="ModelId">The model id the provider reported.</param>
/// <param name="MatchedAs">The EcoLogits model used, as <c>provider/name</c>; <c>null</c> when not estimated.</param>
/// <param name="Status">Whether the usage was estimated.</param>
/// <param name="Co2eGrams">Estimated emissions in grams CO2e; <c>null</c> when not estimated.</param>
/// <param name="Requests">The successful requests counted.</param>
/// <param name="OutputTokens">The output tokens counted.</param>
/// <param name="Warnings">Warning codes, from EcoLogits for the matched model or from this package.</param>
public sealed record AICarbonModelEstimate(
    string ProviderId,
    string ModelId,
    string? MatchedAs,
    AICarbonEstimateStatus Status,
    RangeValue? Co2eGrams,
    long Requests,
    long OutputTokens,
    IReadOnlyList<string> Warnings);
