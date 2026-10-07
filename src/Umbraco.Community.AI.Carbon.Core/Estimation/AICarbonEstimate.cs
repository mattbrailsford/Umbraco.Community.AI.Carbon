using Umbraco.AI.Core.Analytics.Usage;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// An estimate of the CO2e of Umbraco.AI usage in a period. All figures are estimates, in grams CO2e and
/// watt hours, as low and high values.
/// </summary>
/// <param name="From">Start of the period (inclusive).</param>
/// <param name="To">End of the period (exclusive).</param>
/// <param name="Granularity">The bucket size used (the requested one, or Umbraco.AI's automatic choice).</param>
/// <param name="Total">The sum of everything that could be estimated.</param>
/// <param name="ByModel">One row per provider and model, including those that could not be estimated.</param>
/// <param name="ByFeature">The split by feature type.</param>
/// <param name="TimeSeries">The estimate per bucket.</param>
/// <param name="NotEstimated">Usage that was counted but not estimated.</param>
/// <param name="Method">How the figures were calculated.</param>
public sealed record AICarbonEstimate(
    DateTime From,
    DateTime To,
    AIUsagePeriod Granularity,
    AICarbonTotal Total,
    IReadOnlyList<AICarbonModelEstimate> ByModel,
    AICarbonFeatureBreakdown ByFeature,
    IReadOnlyList<AICarbonTimeSeriesPoint> TimeSeries,
    AICarbonNotEstimated NotEstimated,
    AICarbonMethod Method);
