using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using NUnit.Framework;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Community.AI.Carbon.Core.Resolution;
using Umbraco.Community.AI.Carbon.Extensions;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Resolution;

[TestFixture]
public class ModelResolverRegistrationTests
{
    private static ServiceProvider Compose(Action<IUmbracoBuilder>? customise = null)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        var config = new ConfigurationBuilder().Build();
        var builder = new UmbracoBuilder(services, config, new TypeLoader(Mock.Of<ITypeFinder>(), Mock.Of<ILogger<TypeLoader>>()));
        builder.AddAICarbon();
        customise?.Invoke(builder);
        builder.Build(); // registers the collection builders, as Umbraco does at the end of startup
        return services.BuildServiceProvider();
    }

    private sealed class HouseResolver : IAICarbonModelResolver
    {
        public Core.EcoLogits.EcoLogitsModel? Resolve(AICarbonModelResolutionContext context) => null;
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
