using Microsoft.Extensions.Options;
using Umbraco.AI.Core.Analytics;
using Umbraco.AI.Core.Analytics.Usage;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Reads Umbraco.AI's usage analytics for an estimate window, one window at a time. For Daily buckets in a
/// viewer's zone the window is read as the hourly and daily parts <see cref="AICarbonLocalDays.Plan"/> works out and
/// merged onto local days; otherwise it is a single read, as before. Calls are awaited one after another because
/// Umbraco.AI's analytics service runs on EF scopes that are not safe for concurrent use.
/// </summary>
internal sealed class AICarbonUsageReader
{
    // How far before the clock's guess of where hourly rows start the line is looked for.
    private const int LookBackDays = 3;

    // A window ending this far before the guess has no hourly part, so the line is not looked for.
    private const int LineMarginDays = 2;

    private readonly IAIUsageAnalyticsService _usage;
    private readonly IOptionsMonitor<AIAnalyticsOptions> _analyticsOptions;
    private readonly TimeProvider _time;

    /// <summary>The usage figures of a window that the estimate needs.</summary>
    /// <param name="Requests">All requests, successful and failed.</param>
    /// <param name="Successes">Successful requests.</param>
    /// <param name="OutputTokens">Output tokens, including those of failed requests.</param>
    internal readonly record struct Totals(long Requests, long Successes, long OutputTokens);

    /// <summary>One bucket of a series; its timestamp is the UTC start of the hour, UTC day or local day.</summary>
    /// <param name="Timestamp">The bucket start (UTC).</param>
    /// <param name="Successes">Successful requests.</param>
    /// <param name="OutputTokens">Output tokens, including those of failed requests.</param>
    internal readonly record struct Point(DateTime Timestamp, long Successes, long OutputTokens);

    /// <summary>A window with the reads it takes, fixed once so a settings reload cannot change them mid-estimate.</summary>
    /// <param name="From">Start of the window (UTC, inclusive).</param>
    /// <param name="To">End of the window (UTC, exclusive).</param>
    /// <param name="Bucket">The bucket size of the estimate.</param>
    /// <param name="TimeZone">The viewer's zone when Daily buckets are local days, otherwise <c>null</c>.</param>
    /// <param name="Segments">The reads that make up the window.</param>
    /// <param name="HourlyLine">For local days, the UTC midnight from which days are read from hourly rows; otherwise the minimum date.</param>
    internal sealed record Window(
        DateTime From, DateTime To, AIUsagePeriod Bucket, TimeZoneInfo? TimeZone, IReadOnlyList<AICarbonLocalDays.Segment> Segments, DateTime HourlyLine);

    /// <summary>Initializes a new instance of the <see cref="AICarbonUsageReader"/> class.</summary>
    /// <param name="usage">Umbraco.AI's usage analytics.</param>
    /// <param name="analyticsOptions">Umbraco.AI's analytics options (the hourly retention).</param>
    /// <param name="time">The clock; "now" decides where hourly rows start.</param>
    public AICarbonUsageReader(IAIUsageAnalyticsService usage, IOptionsMonitor<AIAnalyticsOptions> analyticsOptions, TimeProvider time)
    {
        _usage = usage;
        _analyticsOptions = analyticsOptions;
        _time = time;
    }

    /// <summary>
    /// Plans the reads for a window. For Daily buckets in a zone the split line is where hourly rows really start,
    /// found with two series reads, one hourly and one daily (see <see cref="FindHourlyLineAsync"/>); there are no extra calls
    /// for other windows or when the window is clear of the line.
    /// </summary>
    /// <param name="from">Start (UTC, inclusive).</param>
    /// <param name="to">End (UTC, exclusive).</param>
    /// <param name="bucket">The bucket size.</param>
    /// <param name="timeZone">The viewer's zone, or <c>null</c> for UTC days.</param>
    /// <param name="ct">Cancels the reads.</param>
    /// <returns>The window.</returns>
    public async Task<Window> CreateWindowAsync(DateTime from, DateTime to, AIUsagePeriod bucket, TimeZoneInfo? timeZone, CancellationToken ct)
    {
        var localDays = timeZone is not null && bucket == AIUsagePeriod.Daily ? timeZone : null;
        var line = DateTime.MinValue;
        if (localDays is not null)
        {
            var now = _time.GetUtcNow().UtcDateTime;
            var today = new DateTime(now.Year, now.Month, now.Day, 0, 0, 0, DateTimeKind.Utc);

            // Today is never rolled up or cleaned up, so the line is never after it: today's usage is always hourly.
            line = Earliest(AICarbonLocalDays.ClockLine(_analyticsOptions.CurrentValue.UsageHourlyRetentionDays, now), today);
            if (from < now && to > line.AddDays(-LineMarginDays))
            {
                line = await FindHourlyLineAsync(line, today, from, to, ct).ConfigureAwait(false);
            }

            line = Earliest(line, today);
        }

        return new Window(from, to, bucket, localDays, AICarbonLocalDays.Plan(from, to, bucket, localDays, line), line);
    }

    private static DateTime Earliest(DateTime a, DateTime b) => a < b ? a : b;

    private static DateTime Latest(DateTime a, DateTime b) => a > b ? a : b;

    private static DateTime FloorToDay(DateTime utc) => new(utc.Year, utc.Month, utc.Day, 0, 0, 0, DateTimeKind.Utc);

    // Umbraco.AI's Usage tab reads days from hourly rows from min(lastDailyDay + 1, ceilDay(first hourly row)) on,
    // and the days before from daily rows. Its reader is internal, so this finds the same line through the public
    // service. The cleanup job deletes hourly rows older than a cutoff, so a UTC day whose daily total is more than
    // its hourly total has lost hourly rows (a whole day, or the first, partly cleaned one). The line is the day
    // after the last such day in the part of the window near and after the clock's guess; with none, hourly rows
    // are read from the start of that part. A day with no usage has no daily and no hourly rows, so it is neither
    // evidence of cleanup nor evidence against it and never moves the line. The days before the line are read from
    // their daily rows, so no usage that has a daily row is dropped. Two unfiltered series reads, hourly and daily,
    // over the window from three days before the guess (or its start, if later) to the end of today or the window.
    // Limits: cleaned days more than three days before the guess are not looked for; a daily rollup that is days
    // behind shows its days as intact (their hourly rows are the only rows, so they are read hourly, which is right);
    // and a record arriving between the two reads can make today look cleaned, which the clamp to today absorbs.
    private async Task<DateTime> FindHourlyLineAsync(DateTime clockLine, DateTime today, DateTime from, DateTime to, CancellationToken ct)
    {
        var start = Latest(FloorToDay(from), clockLine.AddDays(-LookBackDays));
        var end = FloorToDay(to) < to ? FloorToDay(to).AddDays(1) : FloorToDay(to);
        end = Earliest(end, today.AddDays(1));
        if (start >= end)
        {
            return start;
        }

        // Hourly first: a record landing between the reads then shows as extra daily usage on today at most.
        var hourly = await _usage.GetTimeSeriesAsync(start, end, AIUsagePeriod.Hourly, filter: null, ct).ConfigureAwait(false);
        var hourlyByDay = hourly
            .GroupBy(point => FloorToDay(point.Timestamp))
            .ToDictionary(group => group.Key, group => group.Sum(point => (long)point.RequestCount));

        var daily = await _usage.GetTimeSeriesAsync(start, end, AIUsagePeriod.Daily, filter: null, ct).ConfigureAwait(false);
        var lastCleaned = DateTime.MinValue;
        foreach (var point in daily)
        {
            var day = FloorToDay(point.Timestamp);
            if (point.RequestCount > hourlyByDay.GetValueOrDefault(day) && day > lastCleaned)
            {
                lastCleaned = day;
            }
        }

        return lastCleaned == DateTime.MinValue ? start : lastCleaned.AddDays(1);
    }

    /// <summary>The distinct provider ids with usage in the window.</summary>
    /// <param name="window">The window.</param>
    /// <param name="ct">Cancels the reads.</param>
    /// <returns>The ids.</returns>
    public async Task<List<string>> GetProviderIdsAsync(Window window, CancellationToken ct)
    {
        var ids = new List<string>();
        foreach (var segment in window.Segments)
        {
            ids.AddRange((await _usage.GetBreakdownByProviderAsync(segment.From, segment.To, segment.Granularity, ct).ConfigureAwait(false))
                .Select(item => item.Dimension));
        }

        return ids.Distinct(StringComparer.Ordinal).ToList();
    }

    /// <summary>The distinct model ids with usage in the window.</summary>
    /// <param name="window">The window.</param>
    /// <param name="ct">Cancels the reads.</param>
    /// <returns>The ids.</returns>
    public async Task<List<string>> GetModelIdsAsync(Window window, CancellationToken ct)
    {
        var ids = new List<string>();
        foreach (var segment in window.Segments)
        {
            ids.AddRange((await _usage.GetBreakdownByModelAsync(segment.From, segment.To, segment.Granularity, ct).ConfigureAwait(false))
                .Select(item => item.Dimension));
        }

        return ids.Distinct(StringComparer.Ordinal).ToList();
    }

    /// <summary>Sums the usage matching a filter over the window.</summary>
    /// <param name="window">The window.</param>
    /// <param name="filter">The filter.</param>
    /// <param name="ct">Cancels the reads.</param>
    /// <returns>The totals.</returns>
    public async Task<Totals> GetTotalsAsync(Window window, AIUsageFilter filter, CancellationToken ct)
    {
        var totals = default(Totals);
        foreach (var segment in window.Segments)
        {
            var summary = await _usage.GetSummaryAsync(segment.From, segment.To, segment.Granularity, filter, ct).ConfigureAwait(false);
            totals = new Totals(
                totals.Requests + summary.TotalRequests, totals.Successes + summary.SuccessCount, totals.OutputTokens + summary.OutputTokens);
        }

        return totals;
    }

    /// <summary>
    /// The buckets of the window for a filter, oldest first. For local days each bucket is stamped with its
    /// local day's start and the hourly and daily parts are merged.
    /// </summary>
    /// <param name="window">The window.</param>
    /// <param name="filter">The filter.</param>
    /// <param name="ct">Cancels the reads.</param>
    /// <returns>The buckets.</returns>
    public async Task<List<Point>> GetSeriesAsync(Window window, AIUsageFilter filter, CancellationToken ct)
    {
        var merged = new SortedDictionary<DateTime, Point>();
        foreach (var segment in window.Segments)
        {
            var points = await _usage.GetTimeSeriesAsync(segment.From, segment.To, segment.Granularity, filter, ct).ConfigureAwait(false);
            foreach (var source in points)
            {
                var timestamp = window.TimeZone is { } zone
                    ? AICarbonLocalDays.LocalDayStartOf(source.Timestamp, segment, zone)
                    : source.Timestamp;
                merged.TryGetValue(timestamp, out var sum);
                merged[timestamp] = new Point(
                    timestamp, sum.Successes + source.SuccessCount, sum.OutputTokens + source.OutputTokens);
            }
        }

        return merged.Values.ToList();
    }
}
