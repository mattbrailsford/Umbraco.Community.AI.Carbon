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
        CancellationToken cancellationToken = default)
        => GetEstimateAsync(from, to, granularity, timeZone: null, cancellationToken);

    /// <summary>Gets the estimate for a period, with Daily buckets on the days of a time zone.</summary>
    /// <param name="from">Start of the period (inclusive).</param>
    /// <param name="to">End of the period (exclusive); must be after <paramref name="from"/>.</param>
    /// <param name="granularity">The bucket size, or <c>null</c> for the automatic choice Umbraco.AI makes.</param>
    /// <param name="timeZone">
    /// The viewer's time zone. Daily buckets are then local days, matching the days Umbraco.AI's Usage tab counts
    /// (days that no longer have hourly rows only exist as UTC days and go to the local day their midday falls on),
    /// and each point's timestamp is the start of its local day. <c>null</c> means UTC days. Hourly buckets are the
    /// same either way. The split between the two kinds of day is found from the data: with two series reads of
    /// Umbraco.AI's usage (hourly and daily, over the window from three days before the clock's guess of where
    /// hourly rows start), the days from the day after the last UTC day whose daily total is more than its hourly
    /// total (its hourly rows were cleaned up) are read hourly; the earlier days are read from their daily rows.
    /// A day without usage never moves the split. Limits: when retention was lowered or the cleanup job is not
    /// running, days that still have hourly rows but lie more than three days before the clock's guess are read as
    /// UTC days (totals stay exact, only their split across local days can differ from the Usage tab); a daily rollup that is days behind is not seen (those days are still hourly, which
    /// is right); and a Daily request with a zone makes these two extra reads unless its window ends well before
    /// the hourly period or starts in the future.
    /// </param>
    /// <param name="cancellationToken">Cancels the estimate.</param>
    /// <returns>The estimate. <c>From</c> and <c>To</c> are normalised to UTC (local times convert, unspecified ones are taken as UTC).</returns>
    /// <exception cref="ArgumentException">
    /// The period is empty, or longer than <see cref="AICarbonEstimateLimits"/> allows for its bucket size.
    /// </exception>
    Task<AICarbonEstimate> GetEstimateAsync(
        DateTime from,
        DateTime to,
        AIUsagePeriod? granularity,
        TimeZoneInfo? timeZone,
        CancellationToken cancellationToken = default);
}
