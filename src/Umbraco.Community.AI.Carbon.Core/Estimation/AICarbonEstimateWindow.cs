using Umbraco.AI.Core.Analytics.Usage;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// How a requested period is normalised before it is estimated. One source for the estimate service and
/// its cache, so both agree on what "the same request" is.
/// </summary>
internal static class AICarbonEstimateWindow
{
    /// <summary>Normalises a time to UTC, by the same rule as Umbraco.AI's UtcDateTimeJsonConverter: local times convert, unspecified ones are taken as UTC.</summary>
    /// <param name="value">The time to normalise.</param>
    /// <returns>The UTC time.</returns>
    public static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Local => value.ToUniversalTime(),
        DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        _ => value,
    };

    /// <summary>Gets the bucket size: the requested one, else the choice Umbraco.AI makes (AIUsageAnalyticsService.DetermineGranularity).</summary>
    /// <param name="requested">The requested bucket size, if any.</param>
    /// <param name="fromUtc">Start of the period, as returned by <see cref="ToUtc"/>.</param>
    /// <param name="toUtc">End of the period, as returned by <see cref="ToUtc"/>.</param>
    /// <returns>The bucket size.</returns>
    public static AIUsagePeriod ResolveGranularity(AIUsagePeriod? requested, DateTime fromUtc, DateTime toUtc)
        => requested ?? ((toUtc - fromUtc).TotalDays <= 7 ? AIUsagePeriod.Hourly : AIUsagePeriod.Daily);
}
