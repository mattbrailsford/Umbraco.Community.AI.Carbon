namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The estimated emissions in one hourly or daily bucket.
/// </summary>
/// <param name="Timestamp">The UTC start of the bucket (the start of the hour or day).</param>
/// <param name="Co2eGrams">Estimated emissions in grams CO2e.</param>
public sealed record AICarbonTimeSeriesPoint(DateTime Timestamp, RangeValue Co2eGrams);
