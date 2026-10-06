using Microsoft.Extensions.Logging;
using Moq;
using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Resolution;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Resolution;

[TestFixture]
public class NormalizedNameResolverTests
{
    private static EcoLogitsModel? Resolve(string modelId, IEcoLogitsDataRepository? data = null, ILogger<NormalizedNameResolver>? logger = null)
        => new NormalizedNameResolver(data ?? EcoLogitsDataRepository.LoadEmbedded(), logger ?? Mock.Of<ILogger<NormalizedNameResolver>>())
            .Resolve(new AICarbonModelResolutionContext("any-provider", modelId));

    [TestFixture]
    public class GivenAnExactName
    {
        [Test]
        public void ItWinsOverDateStripping()
            => Assert.That(Resolve("gpt-4o-2024-08-06")?.Name, Is.EqualTo("gpt-4o-2024-08-06"));
    }

    [TestFixture]
    public class GivenAnUnknownDate
    {
        [Test]
        public void TheDateIsStrippedAsAFallback()
            => Assert.That(Resolve("gpt-4o-2031-01-01")?.Name, Is.EqualTo("gpt-4o"));

        [Test]
        public void ACompactDateIsStrippedToo()
            => Assert.That(Resolve("claude-opus-4-6-20300101")?.Name, Is.EqualTo("claude-opus-4-6"));
    }

    [TestFixture]
    public class GivenBedrockDecorations
    {
        [Test]
        public void ARegionVendorAndVersionAreStripped()
            => Assert.That(Resolve("eu.anthropic.claude-opus-4-6-v1:0")?.Name, Is.EqualTo("claude-opus-4-6"));

        [Test]
        public void ThePrefixedVendorBecomesTheMatchedProvider()
            => Assert.That(Resolve("eu.anthropic.claude-opus-4-6-v1:0")?.Provider, Is.EqualTo("anthropic"));
    }

    [TestFixture]
    public class GivenAVendorHint
    {
        private static IEcoLogitsDataRepository Data() => EcoLogitsDataRepository.FromModels(
            EcoLogitsModel.Dense("mistralai", "shared-model-7b", 7),
            EcoLogitsModel.Dense("google_genai", "shared-model-7b", 7));

        [Test]
        public void MistralMapsToTheMistralaiProvider()
            => Assert.That(Resolve("mistral.shared-model-7b", Data())?.Provider, Is.EqualTo("mistralai"));

        [Test]
        public void GoogleMapsToTheGoogleGenAiProvider()
            => Assert.That(Resolve("google/shared-model-7b", Data())?.Provider, Is.EqualTo("google_genai"));
    }

    [TestFixture]
    public class GivenAFirstPartyAndAnAggregatorCopy
    {
        [Test]
        public void TheFirstPartyProviderWins()
            => Assert.That(
                Resolve(
                    "shared-model-7b",
                    EcoLogitsDataRepository.FromModels(
                        EcoLogitsModel.Dense("huggingface_hub", "org/shared-model-7b", 7),
                        EcoLogitsModel.Dense("cohere", "shared-model-7b", 7)))?.Provider,
                Is.EqualTo("cohere"));
    }

    [TestFixture]
    public class GivenAnAmbiguousName
    {
        private Mock<ILogger<NormalizedNameResolver>> _logger = null!;
        private NormalizedNameResolver _resolver = null!;

        [SetUp]
        public void SetUp()
        {
            _logger = new Mock<ILogger<NormalizedNameResolver>>();
            _resolver = new NormalizedNameResolver(
                EcoLogitsDataRepository.FromModels(
                    EcoLogitsModel.Dense("mistralai", "shared-model-7b", 7),
                    EcoLogitsModel.Dense("cohere", "shared-model-7b", 7)),
                _logger.Object);
        }

        [Test]
        public void ItResolvesToNothing()
            => Assert.That(_resolver.Resolve(new AICarbonModelResolutionContext("x", "shared-model-7b")), Is.Null);

        [Test]
        public void ItLogsTheCandidatesOnlyOnce()
        {
            _resolver.Resolve(new AICarbonModelResolutionContext("x", "shared-model-7b"));
            _resolver.Resolve(new AICarbonModelResolutionContext("x", "shared-model-7b"));

            _logger.Verify(
                l => l.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("mistralai/shared-model-7b") && v.ToString()!.Contains("cohere/shared-model-7b")),
                    It.IsAny<Exception?>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.Once);
        }
    }

    [TestCase("")]
    [TestCase("   ")]
    [TestCase("/")]
    [TestCase(".")]
    [TestCase(":0")]
    [TestCase("us.")]
    public void OddInputResolvesToNothingWithoutThrowing(string modelId)
        => Assert.That(Resolve(modelId), Is.Null);

    [TestFixture]
    public class GivenAGatewayStyleName
    {
        [Test]
        public void VersionDotsBecomeHyphensAsAFallback()
            => Assert.That(Resolve("anthropic/claude-sonnet-4.6")?.Name, Is.EqualTo("claude-sonnet-4-6"));

        [Test]
        public void ATrailingTurboIsDroppedAsAFallback()
            => Assert.That(
                Resolve(
                    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                    EcoLogitsDataRepository.FromModels(EcoLogitsModel.Dense("huggingface_hub", "meta-llama/Llama-3.3-70B-Instruct", 70)))?.Name,
                Is.EqualTo("meta-llama/Llama-3.3-70B-Instruct"));

        [Test]
        public void ADottedVersionThatExistsAsWrittenStillMatchesExactly()
            => Assert.That(Resolve("gpt-4.1")?.Name, Is.EqualTo("gpt-4.1"));

        [Test]
        public void ATurboNameThatExistsAsWrittenStillMatchesExactly()
            => Assert.That(Resolve("gpt-4-turbo")?.Name, Is.EqualTo("gpt-4-turbo"));
    }

    [TestFixture]
    public class GivenAVendorHintThatOnlyStartsLikeAProvider
    {
        [Test]
        public void ItDoesNotCountAsAMatch()
        {
            // "goo" is not a vendor alias and not an EcoLogits provider key, so it must not prefer google_genai; the two first-party candidates stay ambiguous.
            var data = EcoLogitsDataRepository.FromModels(
                EcoLogitsModel.Dense("google_genai", "shared-model-7b", 7),
                EcoLogitsModel.Dense("cohere", "shared-model-7b", 7));

            Assert.That(Resolve("goo/shared-model-7b", data)?.Provider, Is.Null);
        }
    }
}
