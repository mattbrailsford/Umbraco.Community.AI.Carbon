using Umbraco.AI.Core.Analytics.Usage;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Estimates the CO2e of Umbraco.AI usage from the usage Umbraco.AI has recorded.
/// </summary>
public interface IAICarbonEstimateService
{
    /// <summary>Gets the estimate for a period.</summary>
    /// <param name="from">Start of the period (inclusive).</param>
    /// <param name="to">End of the period (exclusive); must be after <paramref name="from"/>.</param>
    /// <param name="granularity">The bucket size, or <c>null</c> for the automatic choice Umbraco.AI makes.</param>
    /// <param name="cancellationToken">Cancels the estimate.</param>
    /// <returns>The estimate. <c>From</c> and <c>To</c> are normalised to UTC (local times convert, unspecified ones are taken as UTC).</returns>
    /// <exception cref="ArgumentException">
    /// The period is empty, or longer than <see cref="AICarbonEstimateLimits"/> allows for its bucket size.
    /// </exception>
    Task<AICarbonEstimate> GetEstimateAsync(
        DateTime from,
        DateTime to,
        AIUsagePeriod? granularity,
        CancellationToken cancellationToken = default);
}
