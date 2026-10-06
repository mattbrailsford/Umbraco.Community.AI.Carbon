// Test support: builds the real estimate service with real collaborators except usage analytics.
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Umbraco.AI.Core.Analytics;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Core.Resolution;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Support;

internal static class EstimateServiceFactory
{
    // T9 adds the behaviour behind electricityZone; T5 only feeds it into the options.
    public static IAICarbonEstimateService Create(
        IAIUsageAnalyticsService usage,
        bool analyticsEnabled = true,
        bool featureTypeDimension = true,
        string? electricityZone = null,
        IDictionary<string, string>? modelMappings = null,
        IEcoLogitsDataRepository? data = null,
        IAICarbonModelResolver? extraResolver = null)
    {
        if (usage is FakeUsageAnalyticsService fake)
        {
            fake.IncludeFeatureTypeDimension = featureTypeDimension;
        }

        data ??= EcoLogitsDataRepository.LoadEmbedded();
        var carbonOptions = Options.Create(new AICarbonOptions
        {
            ElectricityZone = electricityZone,
            ModelMappings = new Dictionary<string, string>(modelMappings ?? new Dictionary<string, string>()),
        });
        var analyticsOptions = Mock.Of<IOptionsMonitor<AIAnalyticsOptions>>(monitor => monitor.CurrentValue == new AIAnalyticsOptions
        {
            Enabled = analyticsEnabled,
            IncludeUsageFeatureTypeDimension = featureTypeDimension,
        });

        var resolvers = new List<IAICarbonModelResolver>
        {
            new ConfiguredMappingResolver(data, carbonOptions, NullLogger<ConfiguredMappingResolver>.Instance),
            new DirectProviderResolver(data, carbonOptions),
            new NormalizedNameResolver(data, NullLogger<NormalizedNameResolver>.Instance),
        };
        if (extraResolver is not null)
        {
            resolvers.Insert(0, extraResolver);
        }

        var factors = new ModelFactorResolver(
            new AICarbonModelResolverCollection(() => resolvers),
            data,
            new CarbonFactorCalculator(),
            NullLogger<ModelFactorResolver>.Instance);

        return new AICarbonEstimateService(usage, analyticsOptions, data, factors);
    }
}
