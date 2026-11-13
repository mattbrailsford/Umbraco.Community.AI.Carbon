using Microsoft.Extensions.Options;
using Umbraco.AI.Core.Analytics;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Core.Models;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <inheritdoc />
internal sealed class AICarbonEstimateService : IAICarbonEstimateService
{
    private readonly AICarbonUsageReader _usage;
    private readonly IOptionsMonitor<AIAnalyticsOptions> _analyticsOptions;
    private readonly IEcoLogitsDataRepository _data;
    private readonly ModelFactorResolver _factors;
    private readonly AICarbonFeatureSplitter _featureSplitter;
    private readonly IOptionsMonitor<AICarbonOptions> _carbonOptions;

    // A by-model row plus what the public row does not carry: its energy, the factor lookup (so later
    // per-feature work can reuse it without resolving the model again) and its emissions per bucket.
    private readonly record struct ModelRow(
        AICarbonModelEstimate Estimate,
        RangeValue EnergyWh,
        ModelFactorLookup? Lookup,
        IReadOnlyList<AICarbonTimeSeriesPoint> Buckets);

    /// <summary>Initializes a new instance of the <see cref="AICarbonEstimateService"/> class.</summary>
    /// <param name="usage">Reads Umbraco.AI's usage analytics, as local days where the request has a zone.</param>
    /// <param name="analyticsOptions">Umbraco.AI's analytics options.</param>
    /// <param name="data">The EcoLogits reference data.</param>
    /// <param name="factors">Finds the carbon factor for a model.</param>
    /// <param name="featureSplitter">Builds the split by feature type.</param>
    /// <param name="carbonOptions">This package's options, read on every estimate.</param>
    public AICarbonEstimateService(
        AICarbonUsageReader usage,
        IOptionsMonitor<AIAnalyticsOptions> analyticsOptions,
        IEcoLogitsDataRepository data,
        ModelFactorResolver factors,
        AICarbonFeatureSplitter featureSplitter,
        IOptionsMonitor<AICarbonOptions> carbonOptions)
    {
        _usage = usage;
        _analyticsOptions = analyticsOptions;
        _data = data;
        _factors = factors;
        _featureSplitter = featureSplitter;
        _carbonOptions = carbonOptions;
    }

    /// <inheritdoc />
    public async Task<AICarbonEstimate> GetEstimateAsync(
        DateTime from,
        DateTime to,
        AIUsagePeriod? granularity,
        TimeZoneInfo? timeZone,
        CancellationToken cancellationToken = default)
    {
        from = AICarbonEstimateWindow.ToUtc(from);
        to = AICarbonEstimateWindow.ToUtc(to);
        if (from >= to)
        {
            throw new ArgumentException("The start of the period must be before its end.", nameof(from));
        }

        var bucket = AICarbonEstimateWindow.ResolveGranularity(granularity, from, to);
        var maxDays = AICarbonEstimateWindow.MaxWindowDays(bucket);
        if ((to - from).TotalDays > maxDays)
        {
            throw new ArgumentException(
                $"A period with {bucket.ToString().ToLowerInvariant()} buckets can span at most {maxDays} days.", nameof(to));
        }

        var analyticsEnabled = _analyticsOptions.CurrentValue.Enabled;

        // Read once so a configuration reload mid-estimate cannot mix zones within one result.
        var zoneOverride = _factors.GetZoneOverride();

        // The reads are planned once, so every figure of the estimate covers the same window.
        var window = await _usage.CreateWindowAsync(from, to, bucket, timeZone, cancellationToken).ConfigureAwait(false);

        var rows = analyticsEnabled
            ? await GetModelRowsAsync(window, zoneOverride, cancellationToken).ConfigureAwait(false)
            : [];

        return await BuildEstimateAsync(window, analyticsEnabled, zoneOverride, rows, cancellationToken).ConfigureAwait(false);
    }

    private async Task<List<ModelRow>> GetModelRowsAsync(
        AICarbonUsageReader.Window window, string? zoneOverride, CancellationToken ct)
    {
        var providers = await _usage.GetProviderIdsAsync(window, ct).ConfigureAwait(false);
        var models = await _usage.GetModelIdsAsync(window, ct).ConfigureAwait(false);

        var factorCache = new Dictionary<string, ModelFactorLookup>(StringComparer.Ordinal);
        var rows = new List<ModelRow>();

        // The model breakdown carries no provider, so every provider x model pair is probed; pairs with no usage are dropped.
        foreach (var providerId in providers)
        {
            foreach (var modelId in models)
            {
                rows.AddRange(await EstimatePairAsync(providerId, modelId, window, zoneOverride, factorCache, ct).ConfigureAwait(false));
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
        AICarbonUsageReader.Window window,
        string? zoneOverride,
        Dictionary<string, ModelFactorLookup> factorCache,
        CancellationToken ct)
    {
        var allFilter = new AIUsageFilter { ProviderId = providerId, ModelId = modelId };
        var all = await _usage.GetTotalsAsync(window, allFilter, ct).ConfigureAwait(false);
        if (all.Requests == 0)
        {
            return [];
        }

        // The chat figures come from the buckets, not a second summary: a summary and a time series are separate
        // reads (with live data for the current period in between), so only the buckets are guaranteed to add up
        // to the per-model total, and through it to the grand total.
        var chatFilter = new AIUsageFilter { ProviderId = providerId, ModelId = modelId, Capability = AICapability.Chat };
        var chatBuckets = await _usage.GetSeriesAsync(window, chatFilter, ct).ConfigureAwait(false);
        var chatSuccesses = chatBuckets.Sum(point => point.Successes);
        var chatOutputTokens = chatBuckets.Sum(point => point.OutputTokens);

        var rows = new List<ModelRow>(2);
        if (chatSuccesses > 0)
        {
            rows.Add(EstimateChat(providerId, modelId, chatBuckets, chatSuccesses, chatOutputTokens, zoneOverride, factorCache));
        }

        var otherRequests = all.Successes - chatSuccesses;
        if (otherRequests > 0)
        {
            rows.Add(new ModelRow(
                new AICarbonModelEstimate(
                    providerId,
                    modelId,
                    null,
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
        IReadOnlyList<AICarbonUsageReader.Point> buckets,
        long successes,
        long outputTokens,
        string? zoneOverride,
        Dictionary<string, ModelFactorLookup> factorCache)
    {
        var lookup = _factors.Resolve(providerId, modelId, zoneOverride, factorCache);

        if (lookup.Factor is null)
        {
            return new ModelRow(
                new AICarbonModelEstimate(
                    providerId,
                    modelId,
                    null,
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
            var impact = lookup.Factor.Apply(point.OutputTokens, point.Successes);
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
                lookup.Zone,
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
        AICarbonUsageReader.Window window, IEnumerable<ModelRow> estimated)
    {
        var points = new Dictionary<DateTime, RangeValue>();
        foreach (var start in BucketStarts(window))
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

    // The grid of bucket starts. Local days start at each local midnight (see AICarbonLocalDays.LocalDayStartUtc);
    // UTC buckets are described below. As with UTC buckets, a first day that starts before the window is left out.
    private static IEnumerable<DateTime> BucketStarts(AICarbonUsageReader.Window window)
    {
        if (window.TimeZone is { } zone)
        {
            for (var day = AICarbonLocalDays.LocalDate(window.From, zone); ; day = day.AddDays(1))
            {
                var start = AICarbonLocalDays.LocalDayStartUtc(day, zone);
                if (start >= window.To)
                {
                    yield break;
                }

                if (start >= window.From)
                {
                    yield return start;
                }
            }
        }

        for (var start = FirstBucketStart(window.From, window.Bucket); start < window.To; start = NextBucketStart(start, window.Bucket))
        {
            yield return start;
        }
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

    private async Task<AICarbonEstimate> BuildEstimateAsync(
        AICarbonUsageReader.Window window,
        bool analyticsEnabled,
        string? zoneOverride,
        IReadOnlyList<ModelRow> rows,
        CancellationToken ct)
    {
        var estimated = rows.Where(row => row.Estimate.Status == AICarbonEstimateStatus.Estimated).ToList();
        var notEstimated = rows.Where(row => row.Estimate.Status != AICarbonEstimateStatus.Estimated).Select(row => row.Estimate).ToList();

        var co2eGrams = new RangeValue(
            estimated.Sum(row => row.Estimate.Co2eGrams!.Value.Min), estimated.Sum(row => row.Estimate.Co2eGrams!.Value.Max));
        var total = new AICarbonTotal(
            Co2eGrams: co2eGrams,
            EnergyWh: new RangeValue(estimated.Sum(row => row.EnergyWh.Min), estimated.Sum(row => row.EnergyWh.Max)),
            Requests: estimated.Sum(row => row.Estimate.Requests),
            OutputTokens: estimated.Sum(row => row.Estimate.OutputTokens),
            Equivalent: _carbonOptions.CurrentValue.ShowEquivalents ? AICarbonEquivalents.Create(co2eGrams.Max) : null);

        var byFeature = await BuildFeatureBreakdownAsync(window, analyticsEnabled, estimated, ct).ConfigureAwait(false);

        var zones = estimated
            .Select(row => row.Estimate.ElectricityZone)
            .OfType<string>()
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList()
            .AsReadOnly();

        return new AICarbonEstimate(
            window.From,
            window.To,
            window.Bucket,
            total,
            rows.Select(row => row.Estimate).ToList().AsReadOnly(),
            ByFeature: byFeature,
            TimeSeries: BuildTimeSeries(window, estimated),
            NotEstimated: new AICarbonNotEstimated(
                notEstimated.Sum(row => row.Requests), notEstimated.Sum(row => row.OutputTokens), notEstimated.Count),
            Method: new AICarbonMethod(
                AICarbonMethod.EcoLogitsSource,
                _data.DataVersion,
                ElectricityZone: zoneOverride ?? (zones.Count == 1 ? zones[0] : null),
                ElectricityZones: zones,
                ZoneIsOverride: zoneOverride is not null,
                analyticsEnabled));
    }

    // The split needs Umbraco.AI to record feature types, and has nothing to split when analytics are off.
    private Task<AICarbonFeatureBreakdown> BuildFeatureBreakdownAsync(
        AICarbonUsageReader.Window window,
        bool analyticsEnabled,
        IReadOnlyList<ModelRow> estimated,
        CancellationToken ct)
    {
        if (!analyticsEnabled || !_analyticsOptions.CurrentValue.IncludeUsageFeatureTypeDimension)
        {
            return Task.FromResult(AICarbonFeatureSplitter.Unavailable);
        }

        var models = new List<AICarbonFeatureSplitter.EstimatedModel>(estimated.Count);
        foreach (var row in estimated)
        {
            if (row.Lookup?.Factor is { } factor)
            {
                models.Add(new AICarbonFeatureSplitter.EstimatedModel(
                    row.Estimate.ProviderId, row.Estimate.ModelId, factor, row.Estimate.Requests, row.Estimate.OutputTokens));
            }
        }

        return _featureSplitter.SplitAsync(window, models, ct);
    }

    private static RangeValue Scale(RangeValue kilo) => new(kilo.Min * MetricUnits.PerKilo, kilo.Max * MetricUnits.PerKilo);
}
