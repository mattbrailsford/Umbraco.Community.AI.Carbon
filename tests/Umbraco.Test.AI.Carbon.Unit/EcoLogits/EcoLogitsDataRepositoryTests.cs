using System.Text.Json;
using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Core;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.EcoLogits;

[TestFixture]
public class EcoLogitsDataRepositoryTests
{
    private static EcoLogitsDataRepository Data => EcoLogitsDataRepository.LoadEmbedded();

    private static EcoLogitsModel Model(string provider, string name) => Data.GetModel(provider, name)!;

    private static JsonElement ReadJsonResource(string fileName)
    {
        var assembly = typeof(EcoLogitsDataRepository).Assembly;
        using var stream = assembly.GetManifestResourceStream($"Umbraco.Community.AI.Carbon.Core.Data.EcoLogits.{fileName}")!;
        return JsonDocument.Parse(stream).RootElement.Clone();
    }

    private static RangeValue Active(string provider, string name) => Data.GetModel(provider, name)!.ActiveParameters;

    [TestFixture]
    public class GivenTheEmbeddedData
    {
        [Test]
        public void ItLoadsEveryModelAndAliasInTheFile()
            => Assert.That(
                Data.GetModels(),
                Has.Count.EqualTo(ReadJsonResource("models.json").GetProperty("models").GetArrayLength()
                                  + ReadJsonResource("models.json").GetProperty("aliases").GetArrayLength()));

        [Test]
        public void ItLoadsEveryDenseAndMoeModelPlusAliasCopies() => Assert.That(Data.GetModels(), Has.Count.EqualTo(348));

        [Test]
        public void EveryModelInTheFileIsDenseOrMoe()
            => Assert.That(
                ReadJsonResource("models.json").GetProperty("models").EnumerateArray()
                    .Count(m => m.GetProperty("architecture").GetProperty("type").GetString() is "dense" or "moe"),
                Is.EqualTo(ReadJsonResource("models.json").GetProperty("models").GetArrayLength()));

        [Test]
        public void EveryElectricityMixInTheFileIsLoaded()
            => Assert.That(
                ReadJsonResource("electricity_mixes.json").GetProperty("electricity_mixes").EnumerateArray()
                    .Count(m => Data.GetElectricityMix(m.GetProperty("name").GetString()!) is not null),
                Is.EqualTo(ReadJsonResource("electricity_mixes.json").GetProperty("electricity_mixes").GetArrayLength()));

        [Test]
        public void ItReportsTheEcoLogitsVersion() => Assert.That(Data.DataVersion, Is.EqualTo("0.11.2"));

        [Test]
        public void TheEmbeddedInstanceIsParsedOnce() => Assert.That(EcoLogitsDataRepository.LoadEmbedded(), Is.SameAs(Data));
    }

    [TestFixture]
    public class GivenAClosedModelWithARangeOfSizes
    {
        [Test]
        public void ActiveParametersHaveARange()
            => Assert.That(Active("anthropic", "claude-sonnet-4-5").Min, Is.LessThan(Active("anthropic", "claude-sonnet-4-5").Max));
    }

    [TestFixture]
    public class GivenAnEcoLogitsAlias
    {
        [Test]
        public void TheAliasNameResolves() => Assert.That(Data.GetModel("anthropic", "claude-sonnet-4-5"), Is.Not.Null);

        [Test]
        public void TheAliasCopyIsNamedAfterTheAlias() => Assert.That(Model("anthropic", "claude-sonnet-4-5").Name, Is.EqualTo("claude-sonnet-4-5"));

        [Test]
        public void TheListedNameKeepsItsOwnName()
            => Assert.That(Model("anthropic", "claude-sonnet-4-5-20250929").Name, Is.EqualTo("claude-sonnet-4-5-20250929"));

        [Test]
        public void TheAliasCopySharesTheSizeOfItsTarget()
            => Assert.That(Model("anthropic", "claude-sonnet-4-5").ActiveParameters, Is.EqualTo(Model("anthropic", "claude-sonnet-4-5-20250929").ActiveParameters));

        [Test]
        public void LookupIgnoresCase() => Assert.That(Data.GetModel("ANTHROPIC", "Claude-Sonnet-4-5"), Is.Not.Null);

        [Test]
        public void FindByNameReturnsTheAliasCopy()
            => Assert.That(Data.FindModelsByName("claude-sonnet-4-5").Select(m => m.Name), Is.EqualTo(new[] { "claude-sonnet-4-5" }));
    }

    [TestFixture]
    public class GivenParsedModelValues
    {
        [Test]
        public void TotalParametersAreRead() => Assert.That(Model("anthropic", "claude-sonnet-4-5-20250929").TotalParameters, Is.EqualTo(RangeValue.Of(440)));

        [Test]
        public void ActiveMinIsRead() => Assert.That(Active("anthropic", "claude-sonnet-4-5-20250929").Min, Is.EqualTo(44));

        [Test]
        public void ActiveMaxIsRead() => Assert.That(Active("anthropic", "claude-sonnet-4-5-20250929").Max, Is.EqualTo(132));

        [Test]
        public void TpsIsRead() => Assert.That(Model("anthropic", "claude-sonnet-4-5-20250929").Tps, Is.EqualTo(44));

        [Test]
        public void TtftIsRead() => Assert.That(Model("anthropic", "claude-sonnet-4-5-20250929").Ttft, Is.EqualTo(1.18));

        [Test]
        public void NullTpsStaysNull() => Assert.That(Model("google_genai", "gemini-2.5-flash-image").Tps, Is.Null);

        [Test]
        public void TtftIsReadWhenTpsIsNull() => Assert.That(Model("google_genai", "gemini-2.5-flash-image").Ttft, Is.EqualTo(13.48));

        [Test]
        public void ModelWarningsAreRead() => Assert.That(Model("anthropic", "claude-sonnet-4-5-20250929").Warnings, Does.Contain("model-arch-not-released"));

        [Test]
        public void NullWarningsBecomeAnEmptyList() => Assert.That(Model("mistralai", "mistral-small-latest").Warnings, Is.Empty);
    }

    [TestFixture]
    public class GivenReturnedCollections
    {
        [Test]
        public void ModelsCannotBeMutated() => Assert.That(Data.GetModels() is IList<EcoLogitsModel> list && !list.IsReadOnly, Is.False);

        [Test]
        public void FromModelsCopiesItsInput()
        {
            var input = new[] { EcoLogitsModel.Dense("cohere", "x", 7) };
            var repository = EcoLogitsDataRepository.FromModels(input);
            input[0] = EcoLogitsModel.Dense("cohere", "y", 7);
            Assert.That(repository.GetModels().Select(m => m.Name), Is.EqualTo(new[] { "x" }));
        }
    }

    [TestFixture]
    public class GivenAHuggingFaceModelWithAnOrgPrefix
    {
        [Test]
        public void ItIsFoundByTheLastPathSegment()
            => Assert.That(Data.FindModelsByName("gpt-oss-120b").Select(m => $"{m.Provider}:{m.Name}"), Is.EqualTo(new[] { "huggingface_hub:openai/gpt-oss-120b" }));

        [Test]
        public void ItIsFoundByTheFullName() => Assert.That(Data.FindModelsByName("OpenAI/GPT-OSS-120B"), Has.Count.EqualTo(1));

        [Test]
        public void AnUnknownNameFindsNothing() => Assert.That(Data.FindModelsByName("no-such-model"), Is.Empty);
    }

    [TestFixture]
    public class GivenAModelWithAPublishedSize
    {
        [Test]
        public void MinEqualsMax()
            => Assert.That(Active("mistralai", "mistral-small-latest").Min, Is.EqualTo(Active("mistralai", "mistral-small-latest").Max));
    }

    [TestFixture]
    public class GivenElectricityMixes
    {
        [Test]
        public void SwedenIsCleanerThanTheUsa()
            => Assert.That(Data.GetElectricityMix("SWE")!.Gwp, Is.LessThan(Data.GetElectricityMix("USA")!.Gwp));

        [Test]
        public void MixWarningsAreRead() => Assert.That(Data.GetElectricityMix("ABW")!.Warnings, Has.Count.EqualTo(3));

        [Test]
        public void MixGwpIsRead() => Assert.That(Data.GetElectricityMix("ABW")!.Gwp, Is.EqualTo(0.55));

        [Test]
        public void AnUnknownZoneIsNull() => Assert.That(Data.GetElectricityMix("XXX"), Is.Null);
    }

    [TestFixture]
    public class GivenProviderConfigs
    {
        [Test]
        public void AnthropicRunsInTheUsa() => Assert.That(Data.GetProviderConfig("anthropic")!.Zone, Is.EqualTo("USA"));

        [Test]
        public void AKnownProviderExists() => Assert.That(Data.ProviderExists("google_genai"), Is.True);

        [Test]
        public void OpenAiPueIsRead() => Assert.That(Data.GetProviderConfig("openai")!.Pue, Is.EqualTo(RangeValue.Of(1.20)));

        [Test]
        public void OpenAiWueIsRead() => Assert.That(Data.GetProviderConfig("openai")!.Wue, Is.EqualTo(RangeValue.Of(0.569)));

        [Test]
        public void AnthropicPueMinIsRead() => Assert.That(Data.GetProviderConfig("anthropic")!.Pue.Min, Is.EqualTo(1.09));

        [Test]
        public void AnthropicPueMaxIsRead() => Assert.That(Data.GetProviderConfig("anthropic")!.Pue.Max, Is.EqualTo(1.14));

        [Test]
        public void MistralRunsInSweden() => Assert.That(Data.GetProviderConfig("mistralai")!.Zone, Is.EqualTo("SWE"));

        [Test]
        public void AnUnknownProviderDoesNotExist() => Assert.That(Data.ProviderExists("acme"), Is.False);

        [Test]
        public void AnUnknownProviderHasNoConfig() => Assert.That(Data.GetProviderConfig("acme"), Is.Null);
    }

    [TestFixture]
    public class GivenAnUnknownModel
    {
        [Test]
        public void UnknownModelIsNull() => Assert.That(Data.GetModel("anthropic", "no-such-model"), Is.Null);

        [Test]
        public void UnknownProviderIsNull() => Assert.That(Data.GetModel("acme", "claude-sonnet-4-5"), Is.Null);
    }

    [TestFixture]
    public class GivenInMemoryModels
    {
        private static readonly EcoLogitsDataRepository InMemory
            = EcoLogitsDataRepository.FromModels(EcoLogitsModel.Dense("cohere", "x", 7));

        [Test]
        public void TheModelCanBeFound() => Assert.That(InMemory.GetModel("cohere", "x"), Is.Not.Null);

        [Test]
        public void ElectricityMixesStillComeFromTheEmbeddedData() => Assert.That(InMemory.GetElectricityMix("SWE"), Is.Not.Null);
    }
}
