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

    // A by-model row plus what the public row does not carry: its energy and the factor lookup, so
    // later per-bucket and per-feature work can reuse them without resolving the model again.
    private readonly record struct ModelRow(AICarbonModelEstimate Estimate, RangeValue EnergyWh, ModelFactorLookup? Lookup);

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
        if (from >= to)
        {
            throw new ArgumentException("The start of the period must be before its end.", nameof(from));
        }

        var bucket = granularity ?? ChooseGranularity(from, to);
        var analyticsEnabled = _analyticsOptions.CurrentValue.Enabled;

        var rows = analyticsEnabled
            ? await GetModelRowsAsync(from, to, bucket, cancellationToken).ConfigureAwait(false)
            : [];

        return BuildEstimate(from, to, bucket, analyticsEnabled, rows);
    }

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

        var chatFilter = new AIUsageFilter { ProviderId = providerId, ModelId = modelId, Capability = AICapability.Chat };
        var chat = await _usage.GetSummaryAsync(from, to, bucket, chatFilter, ct).ConfigureAwait(false);

        var rows = new List<ModelRow>(2);
        if (chat.SuccessCount > 0)
        {
            rows.Add(EstimateChat(providerId, modelId, chat, factorCache));
        }

        var otherRequests = all.SuccessCount - chat.SuccessCount;
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
                    Math.Max(0, all.OutputTokens - chat.OutputTokens),
                    []),
                default,
                null));
        }

        return rows;
    }

    private ModelRow EstimateChat(
        string providerId, string modelId, AIUsageSummary chat, Dictionary<string, ModelFactorLookup> factorCache)
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
                    chat.SuccessCount,
                    chat.OutputTokens,
                    lookup.Warnings),
                default,
                lookup);
        }

        // Requests count successes only, but output tokens include those of failed requests: generated tokens
        // consumed energy whether or not the call later failed.
        // Each request also carries a time-to-first-token cost, so failed ones are not counted.
        var impact = lookup.Factor.Apply(chat.OutputTokens, chat.SuccessCount);
        return new ModelRow(
            new AICarbonModelEstimate(
                providerId,
                modelId,
                lookup.MatchedAs,
                AICarbonEstimateStatus.Estimated,
                Scale(impact.Co2eKg),
                chat.SuccessCount,
                chat.OutputTokens,
                lookup.Warnings),
            Scale(impact.EnergyKwh),
            lookup);
    }

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
            TimeSeries: [], // T7 fills this
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
