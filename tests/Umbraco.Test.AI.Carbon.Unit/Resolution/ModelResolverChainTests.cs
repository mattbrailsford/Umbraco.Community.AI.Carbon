// S3 (AC1–AC10) — Model resolver chain. Task: T4.
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Resolution;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Resolution;

[TestFixture]
public class ModelResolverChainTests
{
    private static AICarbonModelResolverCollection DefaultChain(
        IDictionary<string, string>? mappings = null,
        ILogger<ConfiguredMappingResolver>? logger = null,
        IAICarbonModelResolver? extra = null,
        IDictionary<string, string>? providerMappings = null,
        IEcoLogitsDataRepository? data = null)
    {
        data ??= EcoLogitsDataRepository.LoadEmbedded();
        var options = new AICarbonOptions
        {
            ModelMappings = new Dictionary<string, string>(mappings ?? new Dictionary<string, string>()),
        };
        foreach (var (providerId, ecoLogitsProvider) in providerMappings ?? new Dictionary<string, string>())
        {
            options.ProviderMappings[providerId] = ecoLogitsProvider; // merged over the shipped defaults
        }

        var wrapped = Microsoft.Extensions.Options.Options.Create(options);
        var resolvers = new List<IAICarbonModelResolver>
        {
            new ConfiguredMappingResolver(data, wrapped, logger ?? Mock.Of<ILogger<ConfiguredMappingResolver>>()),
            new DirectProviderResolver(data, wrapped),
            new NormalizedNameResolver(data, Mock.Of<ILogger<NormalizedNameResolver>>()),
        };
        if (extra is not null)
        {
            resolvers.Insert(0, extra);
        }

        return new AICarbonModelResolverCollection(() => resolvers);
    }

    // Today's EcoLogits data has no name shared across providers, so ambiguity is specified against
    // a small in-memory data set.
    private static IEcoLogitsDataRepository AmbiguousData() => EcoLogitsDataRepository.FromModels(
        EcoLogitsModel.Dense("mistralai", "shared-model-7b", 7),
        EcoLogitsModel.Dense("cohere", "shared-model-7b", 7),
        EcoLogitsModel.Dense("huggingface_hub", "some-org/shared-model-7b", 7));

    [TestFixture]
    public class GivenAModelFromADirectlyMappedProvider
    {
        [Test]
        public void MatchesTheGoogleModelUnderEcoLogitsGoogleGenAi()
            => Assert.That(DefaultChain().Resolve("google", "gemini-2.5-flash")?.Provider, Is.EqualTo("google_genai"));

        [Test]
        public void MatchesTheDatedModelExactly()
            => Assert.That(DefaultChain().Resolve("anthropic", "claude-sonnet-4-5-20250929")?.Name, Is.EqualTo("claude-sonnet-4-5-20250929"));
    }

    [TestFixture]
    public class GivenAModelServedByAHostingProvider
    {
        [Test]
        public void StripsBedrockRegionAndVersionDecorations()
            => Assert.That(DefaultChain().Resolve("amazon", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")?.Name, Is.EqualTo("claude-sonnet-4-5-20250929"));

        [Test]
        public void StripsASlashVendorPrefix()
            => Assert.That(DefaultChain().Resolve("openrouter", "openai/gpt-4o")?.Name, Is.EqualTo("gpt-4o"));

        [Test]
        public void KeepsTheUnderlyingVendorAsTheMatchedProvider()
            => Assert.That(DefaultChain().Resolve("openrouter", "openai/gpt-4o")?.Provider, Is.EqualTo("openai"));
    }

    [TestFixture]
    public class GivenAConfiguredMapping
    {
        [Test]
        public void UsesTheMappingTarget()
            => Assert.That(
                DefaultChain(new Dictionary<string, string> { ["my-gpt-deployment"] = "openai/gpt-4o" })
                    .Resolve("microsoft-foundry", "my-gpt-deployment")?.Name,
                Is.EqualTo("gpt-4o"));

        [Test]
        public void WinsOverTheDirectProviderMatch()
            => Assert.That(
                DefaultChain(new Dictionary<string, string> { ["gpt-4o"] = "openai/gpt-4o-mini" })
                    .Resolve("openai", "gpt-4o")?.Name,
                Is.EqualTo("gpt-4o-mini"));
    }

    [TestFixture]
    public class GivenANewProviderThatIsNotMapped
    {
        [Test]
        public void MatchesByNameUnderWhicheverEcoLogitsProviderKnowsTheModel()
            => Assert.That(DefaultChain().Resolve("groq", "gpt-oss-120b")?.Name, Is.EqualTo("openai/gpt-oss-120b"));
    }

    [TestFixture]
    public class GivenAProviderMappingFromSettings
    {
        [Test]
        public void MatchesUnderTheMappedEcoLogitsProvider()
            => Assert.That(
                DefaultChain(providerMappings: new Dictionary<string, string> { ["my-gateway"] = "openai" })
                    .Resolve("my-gateway", "gpt-4o")?.Provider,
                Is.EqualTo("openai"));

        [Test]
        public void CanReplaceAShippedDefault()
            => Assert.That(
                DefaultChain(
                        providerMappings: new Dictionary<string, string> { ["mistral"] = "cohere" },
                        data: AmbiguousData())
                    .Resolve("mistral", "shared-model-7b")?.Provider,
                Is.EqualTo("cohere"));
    }

    [TestFixture]
    public class GivenANameSharedByMoreThanOneEcoLogitsProvider
    {
        [Test]
        public void PrefersTheVendorNamedInThePrefix()
            => Assert.That(DefaultChain(data: AmbiguousData()).Resolve("openrouter", "mistralai/shared-model-7b")?.Provider, Is.EqualTo("mistralai"));

        [Test]
        public void ResolvesToNothingWithoutAVendorHint()
            => Assert.That(DefaultChain(data: AmbiguousData()).Resolve("openrouter", "shared-model-7b"), Is.Null);
    }

    [TestFixture]
    public class GivenACustomResolverRegisteredFirst
    {
        [Test]
        public void TakesPartInTheChainInRegistrationOrder()
        {
            var custom = new Mock<IAICarbonModelResolver>();
            var expected = EcoLogitsDataRepository.LoadEmbedded().GetModel("openai", "gpt-4o-mini")!;
            custom.Setup(r => r.Resolve(It.Is<AICarbonModelResolutionContext>(c => c.ModelId == "house-model"))).Returns(expected);

            Assert.That(DefaultChain(extra: custom.Object).Resolve("openai", "house-model"), Is.SameAs(expected));
        }
    }

    [TestFixture]
    public class GivenAMappingThatPointsAtAMissingModel
    {
        private Mock<ILogger<ConfiguredMappingResolver>> _logger = null!;
        private EcoLogitsModel? _result;

        [SetUp]
        public void SetUp()
        {
            _logger = new Mock<ILogger<ConfiguredMappingResolver>>();
            _result = DefaultChain(new Dictionary<string, string> { ["my-model"] = "openai/no-such-model" }, _logger.Object)
                .Resolve("microsoft-foundry", "my-model");
        }

        [Test]
        public void ResolvesToNothing()
            => Assert.That(_result, Is.Null);

        [Test]
        public void LogsAWarningNamingTheMapping()
            => _logger.Verify(
                l => l.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("my-model")),
                    It.IsAny<Exception?>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.Once);
    }

    [TestFixture]
    public class GivenAModelNoRuleRecognises
    {
        [Test]
        public void ResolvesToNothing()
            => Assert.That(DefaultChain().Resolve("zai", "glm-unknown-9000"), Is.Null);
    }

    [TestFixture]
    public class GivenAMappingBoundFromJsonForABedrockId
    {
        private static AICarbonModelResolverCollection ChainFor(string json)
        {
            var config = new ConfigurationBuilder()
                .AddJsonStream(new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json)))
                .Build();
            var options = new AICarbonOptions();
            config.GetSection(AICarbonOptions.SectionName).Bind(options);
            return DefaultChain(options.ModelMappings);
        }

        private const string Target = "huggingface_hub/meta-llama/Meta-Llama-3.1-70B-Instruct";

        [Test]
        public void ColonFreeKeyWithVersionMatches()
            => Assert.That(
                ChainFor("{\"AICarbon\":{\"ModelMappings\":{\"meta.llama3-1-70b-instruct-v1\":\"" + Target + "\"}}}")
                    .Resolve("amazon", "meta.llama3-1-70b-instruct-v1:0")?.Name,
                Is.EqualTo("meta-llama/Meta-Llama-3.1-70B-Instruct"));

        [Test]
        public void KeyWithoutAnyVersionMatches()
            => Assert.That(
                ChainFor("{\"AICarbon\":{\"ModelMappings\":{\"meta.llama3-1-70b-instruct\":\"" + Target + "\"}}}")
                    .Resolve("amazon", "meta.llama3-1-70b-instruct-v1:0")?.Name,
                Is.EqualTo("meta-llama/Meta-Llama-3.1-70B-Instruct"));

        [Test]
        public void FullyStrippedKeyMatches()
            => Assert.That(
                ChainFor("{\"AICarbon\":{\"ModelMappings\":{\"llama3-1-70b-instruct\":\"" + Target + "\"}}}")
                    .Resolve("amazon", "us.meta.llama3-1-70b-instruct-v1:0")?.Name,
                Is.EqualTo("meta-llama/Meta-Llama-3.1-70B-Instruct"));
    }

    [TestFixture]
    public class GivenACustomResolverThatThrows
    {
        private Mock<ILogger<AICarbonModelResolverCollection>> _logger = null!;
        private AICarbonModelResolverCollection _chain = null!;

        [SetUp]
        public void SetUp()
        {
            _logger = new Mock<ILogger<AICarbonModelResolverCollection>>();
            var throwing = new Mock<IAICarbonModelResolver>();
            throwing.Setup(r => r.Resolve(It.IsAny<AICarbonModelResolutionContext>())).Throws<InvalidOperationException>();
            var data = EcoLogitsDataRepository.LoadEmbedded();
            var options = Microsoft.Extensions.Options.Options.Create(new AICarbonOptions());
            List<IAICarbonModelResolver> resolvers =
            [
                throwing.Object,
                new ConfiguredMappingResolver(data, options, Mock.Of<ILogger<ConfiguredMappingResolver>>()),
                new DirectProviderResolver(data, options),
            ];
            _chain = new AICarbonModelResolverCollection(() => resolvers, _logger.Object);
        }

        [Test]
        public void TheBuiltInResolversStillResolve()
            => Assert.That(_chain.Resolve("openai", "gpt-4o")?.Name, Is.EqualTo("gpt-4o"));

        [Test]
        public void TheFailureIsLoggedOnce()
        {
            _chain.Resolve("openai", "gpt-4o");
            _chain.Resolve("openai", "gpt-4o-mini");

            _logger.Verify(
                l => l.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.IsAny<It.IsAnyType>(),
                    It.IsAny<Exception?>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.Once);
        }
    }
}
