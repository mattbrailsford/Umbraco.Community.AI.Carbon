using Microsoft.Extensions.Options;
using Umbraco.AI.Core.Analytics;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Core.Models;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <inheritdoc />
internal sealed class AICarbonEstimateService : IAICarbonEstimateService
{
    // The factor is in kg and kWh; the API reports grams and Wh.
    private const double UnitsPerKilo = 1000;

    private readonly IAIUsageAnalyticsService _usage;
    private readonly IOptionsMonitor<AIAnalyticsOptions> _analyticsOptions;
    private readonly IEcoLogitsDataRepository _data;
    private readonly ModelFactorResolver _factors;

    // A by-model row plus what the public row does not carry: its energy, the factor lookup (so later
    // per-feature work can reuse it without resolving the model again) and its emissions per bucket.
    private readonly record struct ModelRow(
        AICarbonModelEstimate Estimate,
        RangeValue EnergyWh,
        ModelFactorLookup? Lookup,
        IReadOnlyList<AICarbonTimeSeriesPoint> Buckets);

    /// <summary>Initializes a new instance of the <see cref="AICarbonEstimateService"/> class.</summary>
    /// <param name="usage">Umbraco.AI's usage analytics.</param>
    /// <param name="analyticsOptions">Umbraco.AI's analytics options.</param>
    /// <param name="data">The EcoLogits reference data.</param>
    /// <param name="factors">Finds the carbon factor for a model.</param>
    public AICarbonEstimateService(
        IAIUsageAnalyticsService usage,
        IOptionsMonitor<AIAnalyticsOptions> analyticsOptions,
        IEcoLogitsDataRepository data,
        ModelFactorResolver factors)
    {
        _usage = usage;
        _analyticsOptions = analyticsOptions;
        _data = data;
        _factors = factors;
    }

    /// <inheritdoc />
    public async Task<AICarbonEstimate> GetEstimateAsync(
        DateTime from,
        DateTime to,
        AIUsagePeriod? granularity,
        CancellationToken cancellationToken = default)
    {
        from = ToUtc(from);
        to = ToUtc(to);
        if (from >= to)
        {
            throw new ArgumentException("The start of the period must be before its end.", nameof(from));
        }

        var bucket = granularity ?? ChooseGranularity(from, to);
        var maxDays = bucket == AIUsagePeriod.Hourly
            ? AICarbonEstimateLimits.MaxHourlyWindowDays
            : AICarbonEstimateLimits.MaxDailyWindowDays;
        if ((to - from).TotalDays > maxDays)
        {
            throw new ArgumentException(
                $"A period with {bucket.ToString().ToLowerInvariant()} buckets can span at most {maxDays} days.", nameof(to));
        }

        var analyticsEnabled = _analyticsOptions.CurrentValue.Enabled;

        var rows = analyticsEnabled
            ? await GetModelRowsAsync(from, to, bucket, cancellationToken).ConfigureAwait(false)
            : [];

        return BuildEstimate(from, to, bucket, analyticsEnabled, rows);
    }

    // Same rule as Umbraco.AI's UtcDateTimeJsonConverter: local times convert, unspecified ones are taken as UTC.
    private static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Local => value.ToUniversalTime(),
        DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        _ => value,
    };

    // Umbraco.AI chooses the same way when it is given no granularity (AIUsageAnalyticsService.DetermineGranularity).
    private static AIUsagePeriod ChooseGranularity(DateTime from, DateTime to)
        => (to - from).TotalDays <= 7 ? AIUsagePeriod.Hourly : AIUsagePeriod.Daily;

    private async Task<List<ModelRow>> GetModelRowsAsync(
        DateTime from, DateTime to, AIUsagePeriod bucket, CancellationToken ct)
    {
        // Umbraco.AI's analytics service runs on EF scopes that are not safe for concurrent use, so every
        // call below is awaited one after another.
        var providers = (await _usage.GetBreakdownByProviderAsync(from, to, bucket, ct).ConfigureAwait(false))
            .Select(item => item.Dimension).Distinct(StringComparer.Ordinal).ToList();
        var models = (await _usage.GetBreakdownByModelAsync(from, to, bucket, ct).ConfigureAwait(false))
            .Select(item => item.Dimension).Distinct(StringComparer.Ordinal).ToList();

        var factorCache = new Dictionary<string, ModelFactorLookup>(StringComparer.Ordinal);
        var rows = new List<ModelRow>();

        // The model breakdown carries no provider, so every provider x model pair is probed; pairs with no usage are dropped.
        foreach (var providerId in providers)
        {
            foreach (var modelId in models)
            {
                rows.AddRange(await EstimatePairAsync(providerId, modelId, from, to, bucket, factorCache, ct).ConfigureAwait(false));
            }
        }

        return rows
            .OrderByDescending(row => row.Estimate.Requests)
            .ThenBy(row => row.Estimate.ProviderId, StringComparer.Ordinal)
            .ThenBy(row => row.Estimate.ModelId, StringComparer.Ordinal)
            .ToList();
    }

    private async Task<IReadOnlyList<ModelRow>> EstimatePairAsync(
        string providerId,
        string modelId,
        DateTime from,
        DateTime to,
        AIUsagePeriod bucket,
        Dictionary<string, ModelFactorLookup> factorCache,
        CancellationToken ct)
    {
        var allFilter = new AIUsageFilter { ProviderId = providerId, ModelId = modelId };
        var all = await _usage.GetSummaryAsync(from, to, bucket, allFilter, ct).ConfigureAwait(false);
        if (all.TotalRequests == 0)
        {
            return [];
        }

        // The chat figures come from the buckets, not a second summary: a summary and a time series are separate
        // reads (with live data for the current period in between), so only the buckets are guaranteed to add up
        // to the per-model total, and through it to the grand total.
        var chatFilter = new AIUsageFilter { ProviderId = providerId, ModelId = modelId, Capability = AICapability.Chat };
        var chatBuckets = (await _usage.GetTimeSeriesAsync(from, to, bucket, chatFilter, ct).ConfigureAwait(false)).ToList();
        var chatSuccesses = chatBuckets.Sum(point => (long)point.SuccessCount);
        var chatOutputTokens = chatBuckets.Sum(point => (long)point.OutputTokens);

        var rows = new List<ModelRow>(2);
        if (chatSuccesses > 0)
        {
            rows.Add(EstimateChat(providerId, modelId, chatBuckets, chatSuccesses, chatOutputTokens, factorCache));
        }

        var otherRequests = all.SuccessCount - chatSuccesses;
        if (otherRequests > 0)
        {
            rows.Add(new ModelRow(
                new AICarbonModelEstimate(
                    providerId,
                    modelId,
                    null,
                    AICarbonEstimateStatus.UnsupportedCapability,
                    null,
                    otherRequests,
                    Math.Max(0, all.OutputTokens - chatOutputTokens),
                    []),
                default,
                null,
                []));
        }

        return rows;
    }

    private ModelRow EstimateChat(
        string providerId,
        string modelId,
        IReadOnlyList<AIUsageTimeSeriesPoint> buckets,
        long successes,
        long outputTokens,
        Dictionary<string, ModelFactorLookup> factorCache)
    {
        var lookup = _factors.Resolve(providerId, modelId, factorCache);

        if (lookup.Factor is null)
        {
            return new ModelRow(
                new AICarbonModelEstimate(
                    providerId,
                    modelId,
                    null,
                    AICarbonEstimateStatus.UnknownModel,
                    null,
                    successes,
                    outputTokens,
                    lookup.Warnings),
                default,
                lookup,
                []);
        }

        // Requests count successes only, but output tokens include those of failed requests: generated tokens
        // consumed energy whether or not the call later failed.
        // Each request also carries a time-to-first-token cost, so failed ones are not counted.
        // The model's figures are the sum of its buckets', so the series always adds up to the total.
        var series = new List<AICarbonTimeSeriesPoint>(buckets.Count);
        var co2e = default(RangeValue);
        var energy = default(RangeValue);
        foreach (var point in buckets)
        {
            var impact = lookup.Factor.Apply(point.OutputTokens, point.SuccessCount);
            var bucketCo2e = Scale(impact.Co2eKg);
            var bucketEnergy = Scale(impact.EnergyKwh);
            series.Add(new AICarbonTimeSeriesPoint(point.Timestamp, bucketCo2e));
            co2e = new RangeValue(co2e.Min + bucketCo2e.Min, co2e.Max + bucketCo2e.Max);
            energy = new RangeValue(energy.Min + bucketEnergy.Min, energy.Max + bucketEnergy.Max);
        }

        return new ModelRow(
            new AICarbonModelEstimate(
                providerId,
                modelId,
                lookup.MatchedAs,
                AICarbonEstimateStatus.Estimated,
                co2e,
                successes,
                outputTokens,
                lookup.Warnings),
            energy,
            lookup,
            series);
    }

    // One point for every bucket Umbraco.AI can return for the window, empty ones as zero, plus any bucket it
    // returned outside that grid so the points always add up to the total.
    private static IReadOnlyList<AICarbonTimeSeriesPoint> BuildTimeSeries(
        DateTime from, DateTime to, AIUsagePeriod bucket, IEnumerable<ModelRow> estimated)
    {
        var points = new Dictionary<DateTime, RangeValue>();
        for (var start = FirstBucketStart(from, bucket); start < to; start = NextBucketStart(start, bucket))
        {
            points[start] = default;
        }

        foreach (var point in estimated.SelectMany(row => row.Buckets))
        {
            points.TryGetValue(point.Timestamp, out var sum);
            points[point.Timestamp] = new RangeValue(sum.Min + point.Co2eGrams.Min, sum.Max + point.Co2eGrams.Max);
        }

        return points
            .OrderBy(pair => pair.Key)
            .Select(pair => new AICarbonTimeSeriesPoint(pair.Key, pair.Value))
            .ToList()
            .AsReadOnly();
    }

    // Umbraco.AI stores each bucket at its UTC start and returns the stored buckets whose start lies in
    // [from, to). A window that starts mid-bucket therefore begins at the next bucket: the partial first
    // one is not returned (apart from the current period, which Umbraco.AI reads live; that one is added
    // by BuildTimeSeries when it has usage).
    private static DateTime FirstBucketStart(DateTime from, AIUsagePeriod bucket)
    {
        var start = TruncateToBucket(from, bucket);
        return start < from ? NextBucketStart(start, bucket) : start;
    }

    private static DateTime NextBucketStart(DateTime start, AIUsagePeriod bucket)
        => bucket == AIUsagePeriod.Hourly ? start.AddHours(1) : start.AddDays(1);

    private static DateTime TruncateToBucket(DateTime timestamp, AIUsagePeriod bucket)
        => bucket == AIUsagePeriod.Hourly
            ? new DateTime(timestamp.Year, timestamp.Month, timestamp.Day, timestamp.Hour, 0, 0, DateTimeKind.Utc)
            : new DateTime(timestamp.Year, timestamp.Month, timestamp.Day, 0, 0, 0, DateTimeKind.Utc);

    private AICarbonEstimate BuildEstimate(
        DateTime from, DateTime to, AIUsagePeriod bucket, bool analyticsEnabled, IReadOnlyList<ModelRow> rows)
    {
        var estimated = rows.Where(row => row.Estimate.Status == AICarbonEstimateStatus.Estimated).ToList();
        var notEstimated = rows.Where(row => row.Estimate.Status != AICarbonEstimateStatus.Estimated).Select(row => row.Estimate).ToList();

        var total = new AICarbonTotal(
            Co2eGrams: new RangeValue(
                estimated.Sum(row => row.Estimate.Co2eGrams!.Value.Min), estimated.Sum(row => row.Estimate.Co2eGrams!.Value.Max)),
            EnergyWh: new RangeValue(estimated.Sum(row => row.EnergyWh.Min), estimated.Sum(row => row.EnergyWh.Max)),
            Requests: estimated.Sum(row => row.Estimate.Requests),
            OutputTokens: estimated.Sum(row => row.Estimate.OutputTokens));

        return new AICarbonEstimate(
            from,
            to,
            bucket,
            total,
            rows.Select(row => row.Estimate).ToList().AsReadOnly(),
            ByFeature: new AICarbonFeatureBreakdown(Available: false, Items: []), // T8 fills this
            TimeSeries: BuildTimeSeries(from, to, bucket, estimated),
            NotEstimated: new AICarbonNotEstimated(
                notEstimated.Sum(row => row.Requests), notEstimated.Sum(row => row.OutputTokens), notEstimated.Count),
            Method: new AICarbonMethod(
                AICarbonMethod.EcoLogitsSource,
                _data.DataVersion,
                ElectricityZone: null, // T9 reports the zone in use; until then each provider's own default applies
                ZoneIsOverride: false,
                analyticsEnabled));
    }

    private static RangeValue Scale(RangeValue kilo) => new(kilo.Min * UnitsPerKilo, kilo.Max * UnitsPerKilo);
}
