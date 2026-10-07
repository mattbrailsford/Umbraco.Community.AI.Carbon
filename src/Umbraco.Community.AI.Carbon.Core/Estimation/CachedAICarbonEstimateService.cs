using Microsoft.Extensions.Options;
using Umbraco.AI.Core.Analytics;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.Cms.Core.Cache;
using Umbraco.Community.AI.Carbon.Core.Configuration;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Remembers estimates for <see cref="Duration"/> so a busy dashboard does not recompute the same period.
/// Wraps the calculating service, which stays cache-free. The cache is per server: each node of a
/// load-balanced site computes its own, and the figures only change as new usage is recorded.
/// </summary>
internal sealed class CachedAICarbonEstimateService : IAICarbonEstimateService
{
    /// <summary>How long an estimate is remembered.</summary>
    public static readonly TimeSpan Duration = TimeSpan.FromMinutes(5);

    private const string KeyPrefix = "Umbraco.Community.AI.Carbon.Estimate";

    private readonly IAICarbonEstimateService _inner;
    private readonly IAppPolicyCache _cache;
    private readonly IOptionsMonitor<AIAnalyticsOptions> _analyticsOptions;
    private readonly ModelFactorResolver _factors;
    private readonly IOptionsMonitor<AICarbonOptions> _carbonOptions;
    private readonly TimeSpan _duration;

    /// <summary>Initializes a new instance of the <see cref="CachedAICarbonEstimateService"/> class.</summary>
    /// <param name="inner">The service that calculates the estimate.</param>
    /// <param name="cache">The runtime cache.</param>
    /// <param name="analyticsOptions">Umbraco.AI's analytics options; their flags change the estimate, so they are part of the key.</param>
    /// <param name="factors">Provides the electricity zone override in force, which is also part of the key.</param>
    /// <param name="carbonOptions">This package's options; the equivalents switch changes the estimate, so it is part of the key.</param>
    /// <param name="duration">How long an estimate is remembered; <see cref="Duration"/> unless a test says otherwise.</param>
    public CachedAICarbonEstimateService(
        IAICarbonEstimateService inner,
        IAppPolicyCache cache,
        IOptionsMonitor<AIAnalyticsOptions> analyticsOptions,
        ModelFactorResolver factors,
        IOptionsMonitor<AICarbonOptions> carbonOptions,
        TimeSpan duration)
    {
        _inner = inner;
        _cache = cache;
        _analyticsOptions = analyticsOptions;
        _factors = factors;
        _carbonOptions = carbonOptions;
        _duration = duration;
    }

    /// <inheritdoc />
    public async Task<AICarbonEstimate> GetEstimateAsync(
        DateTime from,
        DateTime to,
        AIUsagePeriod? granularity,
        CancellationToken cancellationToken = default)
    {
        var key = CreateKey(from, to, granularity);
        if (_cache.Get(key) is AICarbonEstimate cached)
        {
            return cached;
        }

        // A throw (invalid window, cancellation, a failing read) leaves nothing behind, so it is never cached.
        // Two concurrent first requests may both compute; the result is the same and the work is short.
        var estimate = await _inner.GetEstimateAsync(from, to, granularity, cancellationToken).ConfigureAwait(false);
        _cache.Insert(key, () => estimate, _duration);
        return estimate;
    }

    // The inputs the estimate depends on, normalised as the calculating service does, plus the settings that
    // change its content, so toggling them is not hidden for the cache's lifetime.
    private string CreateKey(DateTime from, DateTime to, AIUsagePeriod? granularity)
    {
        var fromUtc = AICarbonEstimateWindow.ToUtc(from);
        var toUtc = AICarbonEstimateWindow.ToUtc(to);
        var bucket = AICarbonEstimateWindow.ResolveGranularity(granularity, fromUtc, toUtc);
        var zone = _factors.GetZoneOverride() ?? "-";
        var analytics = _analyticsOptions.CurrentValue;

        return $"{KeyPrefix}|{fromUtc.Ticks}|{toUtc.Ticks}|{bucket}|{zone}|{analytics.Enabled}|{analytics.IncludeUsageFeatureTypeDimension}|{_carbonOptions.CurrentValue.ShowEquivalents}";
    }
}
