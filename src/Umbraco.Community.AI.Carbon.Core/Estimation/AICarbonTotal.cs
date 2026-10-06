namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The estimated impact of all usage that could be estimated.
/// </summary>
/// <param name="Co2eGrams">Estimated emissions in grams CO2e.</param>
/// <param name="EnergyWh">Estimated energy in watt hours.</param>
/// <param name="Requests">The successful chat requests included in the estimate.</param>
/// <param name="OutputTokens">The output tokens included in the estimate.</param>
public sealed record AICarbonTotal(RangeValue Co2eGrams, RangeValue EnergyWh, long Requests, long OutputTokens);
