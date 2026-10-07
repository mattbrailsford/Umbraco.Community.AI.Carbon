namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// How large a period <see cref="IAICarbonEstimateService"/> accepts. The time series holds one point per bucket,
/// so the window is bounded by its bucket size.
/// </summary>
public static class AICarbonEstimateLimits
{
    /// <summary>The longest window, in days, that may use hourly buckets (about 2,200 points).</summary>
    public const int MaxHourlyWindowDays = 93;

    /// <summary>The longest window, in days, that may use daily buckets (about 5 years).</summary>
    public const int MaxDailyWindowDays = 1830;
}
