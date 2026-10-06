namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The estimated emissions of one Umbraco.AI feature type (for example <c>agent</c> or <c>prompt</c>).
/// </summary>
/// <param name="FeatureType">The feature type, or <c>other</c> for usage not attributed to a known type.</param>
/// <param name="Co2eGrams">Estimated emissions in grams CO2e.</param>
/// <param name="Requests">The successful chat requests counted.</param>
public sealed record AICarbonFeatureEstimate(string FeatureType, RangeValue Co2eGrams, long Requests);
