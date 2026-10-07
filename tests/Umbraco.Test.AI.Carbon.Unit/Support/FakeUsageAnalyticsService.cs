// Test support for the estimate service specs (T5, T7, T8, T9).
// Cached input tokens are not reported: they only exist from Umbraco.AI 18.3, below this package's 18.0 floor.
// An in-memory IAIUsageAnalyticsService that honours AIUsageFilter and the breakdown/bucketing rules of
// Umbraco.AI's AIUsageAnalyticsService, so the estimate service is exercised against the real public
// contract rather than per-call mocks. It is an approximation, with these known differences:
//  - The real service reads hourly/daily statistics only up to the start of the current period and raw
//    records only for the current period, so with Daily granularity today's already-aggregated hours are
//    missing upstream. The fake returns everything in the window.
//  - Time series buckets match the real service for stored statistics: UTC start of the hour/day, kept when the
//    bucket start lies in [from, to), so a window starting mid-bucket drops its partial first bucket. The real
//    service also reads the current period live and stores it at the current bucket start even when that start
//    is before `from`; the fake has no clock and does not model that. Empty buckets are never returned (both).
//  - The real filters run in the database under its collation (SQL Server case-insensitive, SQLite ordinal)
//    while its breakdowns group ordinally. The fake compares everything ordinally.
//  - With IncludeUsageFeatureTypeDimension off, Umbraco.AI records FeatureType = null. Set
//    IncludeFeatureTypeDimension = false (EstimateServiceFactory does) and the fake hides FeatureType too,
//    so a feature-split spec cannot pass against data Umbraco.AI could never produce.
//  - No durations, profiles or users are modelled (AverageDurationMs is 0).
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Core.Models;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Support;

/// <param name="Requests">All requests, successful and failed.</param>
/// <param name="FailedRequests">How many of <paramref name="Requests"/> failed.</param>
internal sealed record UsageRow(
    string ProviderId,
    string ModelId,
    AICapability Capability,
    DateTime Timestamp,
    int Requests,
    long OutputTokens,
    long InputTokens = 0,
    long? CachedInputTokens = null,
    string? FeatureType = null,
    int FailedRequests = 0);

internal sealed class FakeUsageAnalyticsService : IAIUsageAnalyticsService
{
    private readonly List<UsageRow> _rows = new();
    private readonly List<CancellationToken> _receivedTokens = new();
    private readonly List<AIUsageFilter?> _receivedFilters = new();
    private readonly List<(int AfterCalls, UsageRow Row)> _lateRows = new();

    /// <summary>Whether Umbraco.AI's feature type dimension is on; when off, rows lose their FeatureType.</summary>
    public bool IncludeFeatureTypeDimension { get; set; } = true;

    /// <summary>The cancellation token of every call made, in order.</summary>
    public IReadOnlyList<CancellationToken> ReceivedTokens => _receivedTokens;

    /// <summary>The filter of every call made, in order (null where the call had none or takes none).</summary>
    public IReadOnlyList<AIUsageFilter?> ReceivedFilters => _receivedFilters;

    /// <summary>
    /// Adds a row that only becomes visible once <paramref name="afterCalls"/> calls have been made, to model
    /// usage recorded between the reads of one estimate.
    /// </summary>
    public FakeUsageAnalyticsService AddAfterCalls(int afterCalls, UsageRow row)
    {
        _lateRows.Add((afterCalls, row));
        return this;
    }

    public FakeUsageAnalyticsService Add(UsageRow row)
    {
        _rows.Add(row);
        return this;
    }

    public Task<AIUsageSummary> GetSummaryAsync(
        DateTime from, DateTime to, AIUsagePeriod? requestedGranularity = null, AIUsageFilter? filter = null, CancellationToken ct = default)
    {
        var rows = Query(from, to, requestedGranularity, filter, ct);
        if (rows.Count == 0)
        {
            return Task.FromResult(new AIUsageSummary
            {
                TotalRequests = 0, InputTokens = 0, OutputTokens = 0, TotalTokens = 0,
                SuccessCount = 0, FailureCount = 0, SuccessRate = 0, AverageDurationMs = 0,
            });
        }

        var total = rows.Sum(r => r.Requests);
        var failed = rows.Sum(r => r.FailedRequests);
        return Task.FromResult(new AIUsageSummary
        {
            TotalRequests = total,
            InputTokens = rows.Sum(r => r.InputTokens),
            OutputTokens = rows.Sum(r => r.OutputTokens),
            TotalTokens = rows.Sum(r => r.InputTokens + r.OutputTokens),
            SuccessCount = total - failed,
            FailureCount = failed,
            SuccessRate = total > 0 ? (double)(total - failed) / total : 0,
            AverageDurationMs = 0,
        });
    }

    public Task<IEnumerable<AIUsageTimeSeriesPoint>> GetTimeSeriesAsync(
        DateTime from, DateTime to, AIUsagePeriod? requestedGranularity = null, AIUsageFilter? filter = null, CancellationToken ct = default)
    {
        var granularity = DetermineGranularity(from, to, requestedGranularity);
        var points = Query(from, to, requestedGranularity, filter, ct)
            .GroupBy(r => BucketStart(r.Timestamp, granularity))
            .Select(g => new AIUsageTimeSeriesPoint
            {
                Timestamp = g.Key,
                RequestCount = g.Sum(r => r.Requests),
                TotalTokens = g.Sum(r => r.InputTokens + r.OutputTokens),
                InputTokens = g.Sum(r => r.InputTokens),
                OutputTokens = g.Sum(r => r.OutputTokens),
                SuccessCount = g.Sum(r => r.Requests - r.FailedRequests),
                FailureCount = g.Sum(r => r.FailedRequests),
            })
            .OrderBy(p => p.Timestamp)
            .ToList();
        return Task.FromResult<IEnumerable<AIUsageTimeSeriesPoint>>(points);
    }

    public Task<IEnumerable<AIUsageBreakdownItem>> GetBreakdownByProviderAsync(
        DateTime from, DateTime to, AIUsagePeriod? requestedGranularity = null, CancellationToken ct = default)
        => Task.FromResult(Breakdown(Query(from, to, requestedGranularity, null, ct), r => r.ProviderId, "Unknown Provider"));

    // Groups on the model id alone, with no provider, exactly like Umbraco.AI.
    public Task<IEnumerable<AIUsageBreakdownItem>> GetBreakdownByModelAsync(
        DateTime from, DateTime to, AIUsagePeriod? requestedGranularity = null, CancellationToken ct = default)
        => Task.FromResult(Breakdown(Query(from, to, requestedGranularity, null, ct), r => r.ModelId, "Unknown Model"));

    // The fake models no profiles; this is only here to satisfy the contract.
    public Task<IEnumerable<AIUsageBreakdownItem>> GetBreakdownByProfileAsync(
        DateTime from, DateTime to, AIUsagePeriod? requestedGranularity = null, CancellationToken ct = default)
        => Task.FromResult(Breakdown(Query(from, to, requestedGranularity, null, ct), _ => string.Empty, "Unknown Profile"));

    // The fake models no users; this is only here to satisfy the contract.
    public Task<IEnumerable<AIUsageBreakdownItem>> GetBreakdownByUserAsync(
        DateTime from, DateTime to, AIUsagePeriod? requestedGranularity = null, CancellationToken ct = default)
        => Task.FromResult(Breakdown(Query(from, to, requestedGranularity, null, ct), _ => "Anonymous", "Anonymous"));

    private static AIUsagePeriod DetermineGranularity(DateTime from, DateTime to, AIUsagePeriod? requested)
        => requested ?? ((to - from).TotalDays <= 7 ? AIUsagePeriod.Hourly : AIUsagePeriod.Daily);

    private static DateTime BucketStart(DateTime timestamp, AIUsagePeriod granularity)
        => granularity == AIUsagePeriod.Hourly
            ? new DateTime(timestamp.Year, timestamp.Month, timestamp.Day, timestamp.Hour, 0, 0, DateTimeKind.Utc)
            : new DateTime(timestamp.Year, timestamp.Month, timestamp.Day, 0, 0, 0, DateTimeKind.Utc);

    // Umbraco.AI selects statistics whose bucket start falls in [from, to), then applies every filter field.
    private List<UsageRow> Query(DateTime from, DateTime to, AIUsagePeriod? requestedGranularity, AIUsageFilter? filter, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        _rows.AddRange(_lateRows.Where(late => late.AfterCalls <= _receivedTokens.Count).Select(late => late.Row));
        _lateRows.RemoveAll(late => late.AfterCalls <= _receivedTokens.Count);
        _receivedTokens.Add(ct);
        _receivedFilters.Add(filter);

        var granularity = DetermineGranularity(from, to, requestedGranularity);
        var rows = _rows.Select(r => IncludeFeatureTypeDimension ? r : r with { FeatureType = null }).Where(r =>
        {
            var bucket = BucketStart(r.Timestamp, granularity);
            return bucket >= from && bucket < to;
        });

        if (filter is not null)
        {
            if (filter.ProviderId is not null)
            {
                rows = rows.Where(r => r.ProviderId == filter.ProviderId);
            }

            if (filter.ModelId is not null)
            {
                rows = rows.Where(r => r.ModelId == filter.ModelId);
            }

            if (filter.Capability is not null)
            {
                rows = rows.Where(r => r.Capability == filter.Capability.Value);
            }

            if (filter.FeatureType is not null)
            {
                rows = rows.Where(r => r.FeatureType == filter.FeatureType);
            }
        }

        return rows.ToList();
    }

    private static IEnumerable<AIUsageBreakdownItem> Breakdown(
        List<UsageRow> rows, Func<UsageRow, string> dimension, string unknownLabel)
    {
        var totalRequests = rows.Sum(r => r.Requests);
        return rows
            .GroupBy(dimension)
            .Select(g => new AIUsageBreakdownItem
            {
                Dimension = string.IsNullOrEmpty(g.Key) ? unknownLabel : g.Key,
                RequestCount = g.Sum(r => r.Requests),
                TotalTokens = g.Sum(r => r.InputTokens + r.OutputTokens),
                Percentage = totalRequests > 0 ? (double)g.Sum(r => r.Requests) / totalRequests * 100 : 0,
            })
            .OrderByDescending(b => b.RequestCount)
            .ToList();
    }
}
