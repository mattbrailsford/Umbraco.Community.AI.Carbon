using Umbraco.AI.Core.Analytics;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Core.Models;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Splits the estimated chat emissions by Umbraco.AI feature type. There is no breakdown by feature in
/// Umbraco.AI's analytics, so each known type is queried with a feature type filter and whatever is left
/// of the total is reported as <c>other</c>.
/// </summary>
internal sealed class AICarbonFeatureSplitter
{
    private readonly IAIUsageAnalyticsService _usage;

    /// <summary>One estimated chat row: the (provider, model) pair, its carbon factor and its chat usage in the total.</summary>
    /// <param name="ProviderId">The provider id.</param>
    /// <param name="ModelId">The model id.</param>
    /// <param name="Factor">The model's carbon factor.</param>
    /// <param name="ChatSuccesses">Successful chat requests counted in the total.</param>
    /// <param name="ChatOutputTokens">Chat output tokens counted in the total.</param>
    internal readonly record struct EstimatedModel(
        string ProviderId, string ModelId, CarbonFactor Factor, long ChatSuccesses, long ChatOutputTokens);

    /// <summary>Initializes a new instance of the <see cref="AICarbonFeatureSplitter"/> class.</summary>
    /// <param name="usage">Umbraco.AI's usage analytics.</param>
    public AICarbonFeatureSplitter(IAIUsageAnalyticsService usage) => _usage = usage;

    /// <summary>The split to report when Umbraco.AI does not record feature types.</summary>
    public static AICarbonFeatureBreakdown Unavailable { get; } = new(Available: false, Items: []);

    /// <summary>Builds the split.</summary>
    /// <param name="from">Start of the window (UTC).</param>
    /// <param name="to">End of the window (UTC).</param>
    /// <param name="bucket">The granularity the estimate uses.</param>
    /// <param name="models">The estimated chat rows, whose usage the items add up to.</param>
    /// <param name="cancellationToken">Cancels the analytics reads.</param>
    /// <returns>
    /// The split. <c>other</c> is worked out in whole requests and tokens per model (the model's chat usage
    /// minus what the known types reported) and only then converted, so the items add up to the total
    /// (within floating point) and no spurious <c>other</c> row appears from rounding. A residual below zero
    /// is clamped to zero; that only happens on real drift, when records arrive between the reads that
    /// produced the total and these ones, and the items then overshoot the total slightly. The opposite
    /// drift also exists: at an hour rollover the last hour can drop out of the later reads before it is
    /// aggregated, and its usage then shows up as <c>other</c>.
    /// </returns>
    public async Task<AICarbonFeatureBreakdown> SplitAsync(
        DateTime from,
        DateTime to,
        AIUsagePeriod bucket,
        IReadOnlyList<EstimatedModel> models,
        CancellationToken cancellationToken)
    {
        // Umbraco.AI's analytics service is not safe for concurrent use, so each call is awaited in turn.
        var items = new List<AICarbonFeatureEstimate>();
        var knownSuccesses = new long[models.Count];
        var knownTokens = new long[models.Count];
        foreach (var featureType in KnownChatFeatureTypes.All)
        {
            var co2e = default(RangeValue);
            long requests = 0;
            for (var i = 0; i < models.Count; i++)
            {
                var model = models[i];
                var filter = new AIUsageFilter
                {
                    ProviderId = model.ProviderId,
                    ModelId = model.ModelId,
                    Capability = AICapability.Chat,
                    FeatureType = featureType,
                };
                var summary = await _usage.GetSummaryAsync(from, to, bucket, filter, cancellationToken).ConfigureAwait(false);
                co2e = Add(co2e, model.Factor.Apply(summary.OutputTokens, summary.SuccessCount));
                requests += summary.SuccessCount;
                knownSuccesses[i] += summary.SuccessCount;
                knownTokens[i] += summary.OutputTokens;
            }

            if (requests > 0 || co2e.Max > 0)
            {
                items.Add(new AICarbonFeatureEstimate(featureType, co2e, requests));
            }
        }

        var otherCo2e = default(RangeValue);
        long otherRequests = 0;
        for (var i = 0; i < models.Count; i++)
        {
            var successes = Math.Max(0, models[i].ChatSuccesses - knownSuccesses[i]);
            var tokens = Math.Max(0, models[i].ChatOutputTokens - knownTokens[i]);
            otherCo2e = Add(otherCo2e, models[i].Factor.Apply(tokens, successes));
            otherRequests += successes;
        }

        if (otherRequests > 0 || otherCo2e.Max > 0)
        {
            items.Add(new AICarbonFeatureEstimate(KnownChatFeatureTypes.Other, otherCo2e, otherRequests));
        }

        return new AICarbonFeatureBreakdown(Available: true, items.AsReadOnly());
    }

    private static RangeValue Add(RangeValue sum, CarbonImpact impact)
        => new(sum.Min + (impact.Co2eKg.Min * MetricUnits.PerKilo), sum.Max + (impact.Co2eKg.Max * MetricUnits.PerKilo));
}
