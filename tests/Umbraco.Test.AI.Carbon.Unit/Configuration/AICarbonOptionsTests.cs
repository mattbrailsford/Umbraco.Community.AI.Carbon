using Microsoft.Extensions.Configuration;
using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Core.Configuration;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Configuration;

[TestFixture]
public class AICarbonOptionsTests
{
    private static AICarbonOptions Bind(Dictionary<string, string?> values)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        var options = new AICarbonOptions();
        configuration.GetSection(AICarbonOptions.SectionName).Bind(options);
        return options;
    }

    [TestFixture]
    public class GivenDefaultOptions
    {
        private AICarbonOptions _options = null!;

        [SetUp]
        public void SetUp() => _options = new AICarbonOptions();

        [Test]
        public void ElectricityZone_Is_Null() => Assert.That(_options.ElectricityZone, Is.Null);

        [Test]
        public void ShowEquivalents_Is_Off() => Assert.That(_options.ShowEquivalents, Is.False);

        [Test]
        public void ModelMappings_Are_Empty() => Assert.That(_options.ModelMappings, Is.Empty);

        [Test]
        public void ProviderMappings_Has_Five_Shipped_Defaults() => Assert.That(_options.ProviderMappings, Has.Count.EqualTo(5));

        [TestCase("openai", "openai")]
        [TestCase("anthropic", "anthropic")]
        [TestCase("google", "google_genai")]
        [TestCase("mistral", "mistralai")]
        [TestCase("huggingface", "huggingface_hub")]
        public void ProviderMappings_Contains_Default(string provider, string expected)
            => Assert.That(_options.ProviderMappings[provider], Is.EqualTo(expected));

        [Test]
        public void Instances_Do_Not_Share_ProviderMappings()
        {
            _options.ProviderMappings["extra"] = "x";
            Assert.That(new AICarbonOptions().ProviderMappings.ContainsKey("extra"), Is.False);
        }
    }

    [TestFixture]
    public class GivenConfigurationAddingAndReplacingMappings
    {
        private AICarbonOptions _options = null!;

        [SetUp]
        public void SetUp() => _options = Bind(new Dictionary<string, string?>
        {
            ["AICarbon:ElectricityZone"] = "SWE",
            ["AICarbon:ProviderMappings:umbraco-foundry"] = "openai",
            ["AICarbon:ProviderMappings:google"] = "google_genai_custom",
            ["AICarbon:ModelMappings:my-gpt-deployment"] = "openai/gpt-4o",
        });

        [Test]
        public void ElectricityZone_Is_Bound() => Assert.That(_options.ElectricityZone, Is.EqualTo("SWE"));

        [Test]
        public void New_Provider_Mapping_Is_Added() => Assert.That(_options.ProviderMappings["umbraco-foundry"], Is.EqualTo("openai"));

        [Test]
        public void Default_Provider_Mapping_Is_Replaced() => Assert.That(_options.ProviderMappings["google"], Is.EqualTo("google_genai_custom"));

        [Test]
        public void Other_Defaults_Are_Kept() => Assert.That(_options.ProviderMappings["mistral"], Is.EqualTo("mistralai"));

        [Test]
        public void Provider_Count_Is_Defaults_Plus_One() => Assert.That(_options.ProviderMappings, Has.Count.EqualTo(6));

        [Test]
        public void Provider_Keys_Are_Case_Insensitive() => Assert.That(_options.ProviderMappings["UMBRACO-FOUNDRY"], Is.EqualTo("openai"));

        [Test]
        public void Model_Keys_Are_Case_Insensitive() => Assert.That(_options.ModelMappings["MY-GPT-DEPLOYMENT"], Is.EqualTo("openai/gpt-4o"));

        [Test]
        public void Differently_Cased_Key_Replaces_Default_Rather_Than_Duplicating()
        {
            var options = Bind(new Dictionary<string, string?> { ["AICarbon:ProviderMappings:OpenAI"] = "anthropic" });
            Assert.That(options.ProviderMappings, Has.Count.EqualTo(5));
        }
    }

    [TestFixture]
    public class GivenShowEquivalentsInJsonConfiguration
    {
        [Test]
        public void ShowEquivalents_Is_Bound()
        {
            using var json = new MemoryStream(System.Text.Encoding.UTF8.GetBytes("""{"AICarbon":{"ShowEquivalents":true}}"""));
            var configuration = new ConfigurationBuilder().AddJsonStream(json).Build();
            var options = new AICarbonOptions();

            configuration.GetSection(AICarbonOptions.SectionName).Bind(options);

            Assert.That(options.ShowEquivalents, Is.True);
        }
    }

    [TestFixture]
    public class GivenDictionariesAssignedDirectly
    {
        [Test]
        public void ModelMappings_Assigned_Are_Case_Insensitive()
        {
            var options = new AICarbonOptions { ModelMappings = new Dictionary<string, string> { ["My-Model"] = "openai/gpt-4o" } };
            Assert.That(options.ModelMappings["my-model"], Is.EqualTo("openai/gpt-4o"));
        }

        [Test]
        public void ProviderMappings_Assigned_Are_Case_Insensitive()
        {
            var options = new AICarbonOptions { ProviderMappings = new Dictionary<string, string> { ["Foo"] = "openai" } };
            Assert.That(options.ProviderMappings["FOO"], Is.EqualTo("openai"));
        }

        [Test]
        public void ProviderMappings_Assigned_Replace_The_Defaults()
            => Assert.That(new AICarbonOptions { ProviderMappings = new Dictionary<string, string>() }.ProviderMappings, Is.Empty);

        [Test]
        public void ModelMappings_Assigned_Null_Gives_An_Empty_Dictionary()
            => Assert.That(new AICarbonOptions { ModelMappings = null! }.ModelMappings, Is.Empty);

        [Test]
        public void ProviderMappings_Assigned_Null_Gives_An_Empty_Dictionary()
            => Assert.That(new AICarbonOptions { ProviderMappings = null! }.ProviderMappings, Is.Empty);

        [Test]
        public void Assigned_Dictionary_Is_Copied()
        {
            var source = new Dictionary<string, string>();
            var options = new AICarbonOptions { ModelMappings = source };
            source["late"] = "openai/gpt-4o";
            Assert.That(options.ModelMappings, Is.Empty);
        }
    }
}
