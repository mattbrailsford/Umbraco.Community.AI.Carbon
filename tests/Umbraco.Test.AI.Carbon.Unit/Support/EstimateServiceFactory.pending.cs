// Test support: builds the real estimate service with real collaborators except usage analytics.
// Enable with T5; T9 adds the electricity zone override parameter.
using Umbraco.Community.AI.Carbon.Core.Estimation;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Support;

internal static class EstimateServiceFactory
{
    // TODO(T5): construct AICarbonEstimateService with:
    // - the given FakeUsageAnalyticsService,
    // - EcoLogitsDataRepository.LoadEmbedded(), the real CarbonFactorCalculator and resolver chain,
    // - AIAnalyticsOptions { Enabled = analyticsEnabled, IncludeUsageFeatureTypeDimension = featureTypeDimension },
    // - AICarbonOptions { ElectricityZone = electricityZone, ModelMappings = modelMappings },
    // - no result cache (or a pass-through cache).
    public static IAICarbonEstimateService Create(
        FakeUsageAnalyticsService usage,
        bool analyticsEnabled = true,
        bool featureTypeDimension = true,
        string? electricityZone = null,
        IDictionary<string, string>? modelMappings = null)
        => throw new NotImplementedException();
}
