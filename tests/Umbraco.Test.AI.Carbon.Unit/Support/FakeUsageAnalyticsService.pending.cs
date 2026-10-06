// Test support for the estimate service specs (T5, T7, T8, T9). Enable with T5.
// An in-memory IAIUsageAnalyticsService that honours AIUsageFilter the way Umbraco.AI does, so the
// estimate service is exercised against the real public contract rather than per-call mocks.
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Core.Models;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Support;

internal sealed record UsageRow(
    string ProviderId,
    string ModelId,
    AICapability Capability,
    DateTime Timestamp,
    int Requests,
    long OutputTokens,
    long InputTokens = 0,
    long? CachedInputTokens = null,
    string? FeatureType = null);

internal sealed class FakeUsageAnalyticsService : IAIUsageAnalyticsService
{
    private readonly List<UsageRow> _rows = new();

    public FakeUsageAnalyticsService Add(UsageRow row)
    {
        _rows.Add(row);
        return this;
    }

    // TODO(T5): implement every IAIUsageAnalyticsService member over _rows:
    // - GetSummaryAsync / GetTimeSeriesAsync apply all AIUsageFilter fields and the from/to window.
    // - GetBreakdownByProviderAsync groups by ProviderId; GetBreakdownByModelAsync groups by ModelId
    //   only (no provider), exactly like Umbraco.AI.
    // - Time series buckets by hour or day per requestedGranularity.
}
