using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using NUnit.Framework;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Core.Resolution;
using Umbraco.Community.AI.Carbon.Extensions;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Resolution;

[TestFixture]
public class ModelResolverRegistrationTests
{
    private static ServiceProvider Compose(Action<IUmbracoBuilder>? customise = null, Action<IUmbracoBuilder>? beforeAddAICarbon = null, IReadOnlyDictionary<string, string?>? settings = null)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        var config = new ConfigurationBuilder().AddInMemoryCollection(settings ?? new Dictionary<string, string?>()).Build();
        var builder = new UmbracoBuilder(services, config, new TypeLoader(Mock.Of<ITypeFinder>(), Mock.Of<ILogger<TypeLoader>>()));
        beforeAddAICarbon?.Invoke(builder);
        builder.AddAICarbon();
        customise?.Invoke(builder);
        builder.Build(); // registers the collection builders, as Umbraco does at the end of startup
        return services.BuildServiceProvider();
    }

    private sealed class HouseResolver : IAICarbonModelResolver
    {
        public Core.EcoLogits.EcoLogitsModel? Resolve(AICarbonModelResolutionContext context) => null;
    }

    private sealed class HouseEstimateService : IAICarbonEstimateService
    {
        public Task<AICarbonEstimate> GetEstimateAsync(DateTime from, DateTime to, Umbraco.AI.Core.Analytics.Usage.AIUsagePeriod? granularity, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    [TestFixture]
    public class GivenAddAICarbonIsCalledTwice
    {
        [Test]
        public void TheResolverChainIsStillTheThreeResolversInOrder()
        {
            using var provider = Compose(b => b.AddAICarbon());

            Assert.That(
                provider.GetRequiredService<AICarbonModelResolverCollection>().Select(r => r.GetType()),
                Is.EqualTo(new[] { typeof(ConfiguredMappingResolver), typeof(DirectProviderResolver), typeof(NormalizedNameResolver) }));
        }

        [Test]
        public void AResolverTheDeveloperRemovedStaysRemoved()
        {
            using var provider = Compose(b =>
            {
                b.AICarbonModelResolvers().Remove<NormalizedNameResolver>();
                b.AddAICarbon();
            });

            Assert.That(provider.GetRequiredService<AICarbonModelResolverCollection>().Select(r => r.GetType()), Does.Not.Contain(typeof(NormalizedNameResolver)));
        }

        [Test]
        public void ThereIsOneEstimateServiceRegistration()
        {
            var services = new ServiceCollection();
            var builder = new UmbracoBuilder(services, new ConfigurationBuilder().Build(), new TypeLoader(Mock.Of<ITypeFinder>(), Mock.Of<ILogger<TypeLoader>>()));

            builder.AddAICarbon().AddAICarbon();

            Assert.That(services.Count(x => x.ServiceType == typeof(IAICarbonEstimateService)), Is.EqualTo(1));
        }
    }

    [TestFixture]
    public class GivenADeveloperRegisteredTheirOwnEstimateServiceFirst
    {
        [Test]
        public void TheResolverChainIsStillRegistered()
        {
            using var provider = Compose(beforeAddAICarbon: b => b.Services.AddSingleton<IAICarbonEstimateService, HouseEstimateService>());

            Assert.That(provider.GetRequiredService<AICarbonModelResolverCollection>(), Is.Not.Empty);
        }

        [Test]
        public void TheConfigIsStillBoundToTheOptions()
        {
            using var provider = Compose(
                beforeAddAICarbon: b => b.Services.AddSingleton<IAICarbonEstimateService, HouseEstimateService>(),
                settings: new Dictionary<string, string?> { ["AICarbon:ElectricityZone"] = "SWE" });

            Assert.That(provider.GetRequiredService<IOptions<AICarbonOptions>>().Value.ElectricityZone, Is.EqualTo("SWE"));
        }

        [Test]
        public void TheirServiceIsTheOneResolved()
        {
            using var provider = Compose(beforeAddAICarbon: b => b.Services.AddSingleton<IAICarbonEstimateService, HouseEstimateService>());

            Assert.That(provider.GetRequiredService<IAICarbonEstimateService>(), Is.TypeOf<HouseEstimateService>());
        }
    }

    [TestFixture]
    public class GivenAddAICarbon
    {
        [Test]
        public void RegistersTheThreeResolversInOrder()
        {
            using var provider = Compose();

            Assert.That(
                provider.GetRequiredService<AICarbonModelResolverCollection>().Select(r => r.GetType()),
                Is.EqualTo(new[] { typeof(ConfiguredMappingResolver), typeof(DirectProviderResolver), typeof(NormalizedNameResolver) }));
        }

        [Test]
        public void TheDefaultChainResolvesAKnownModel()
        {
            using var provider = Compose();

            Assert.That(provider.GetRequiredService<AICarbonModelResolverCollection>().Resolve("openai", "gpt-4o")?.Name, Is.EqualTo("gpt-4o"));
        }

        [Test]
        public void ADeveloperCanInsertAResolverFirst()
        {
            using var provider = Compose(b => b.AICarbonModelResolvers().Insert<HouseResolver>());

            Assert.That(provider.GetRequiredService<AICarbonModelResolverCollection>().First(), Is.TypeOf<HouseResolver>());
        }

        [Test]
        public void ADeveloperCanRemoveAResolver()
        {
            using var provider = Compose(b => b.AICarbonModelResolvers().Remove<NormalizedNameResolver>());

            Assert.That(provider.GetRequiredService<AICarbonModelResolverCollection>().Select(r => r.GetType()), Does.Not.Contain(typeof(NormalizedNameResolver)));
        }
    }
}
