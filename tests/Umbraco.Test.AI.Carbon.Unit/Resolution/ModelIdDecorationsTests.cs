using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Core.Resolution;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Resolution;

[TestFixture]
public class ModelIdDecorationsTests
{
    [TestFixture]
    public class GivenARegionPrefix
    {
        [TestCase("us.claude-x", "claude-x")]
        [TestCase("eu.claude-x", "claude-x")]
        [TestCase("apac.claude-x", "claude-x")]
        [TestCase("global.claude-x", "claude-x")]
        public void ItIsRemoved(string input, string expected)
            => Assert.That(ModelIdDecorations.StripRegionPrefix(input).Name, Is.EqualTo(expected));

        [Test]
        public void ItGivesNoVendorHint()
            => Assert.That(ModelIdDecorations.StripRegionPrefix("us.claude-x").VendorHint, Is.Null);
    }

    [TestFixture]
    public class GivenADottedVendorPrefix
    {
        [Test]
        public void TheVendorIsRemoved()
            => Assert.That(ModelIdDecorations.StripDottedVendorPrefix("meta.llama3-70b").Name, Is.EqualTo("llama3-70b"));

        [Test]
        public void TheVendorBecomesTheHint()
            => Assert.That(ModelIdDecorations.StripDottedVendorPrefix("meta.llama3-70b").VendorHint, Is.EqualTo("meta"));

        [TestCase("gpt-4.1")]
        [TestCase("gemini-2.0-flash")]
        [TestCase("llama3.1-70b")]
        public void AVersionDotIsNotAVendorPrefix(string input)
            => Assert.That(ModelIdDecorations.StripDottedVendorPrefix(input), Is.EqualTo(new StrippedModelId(input, null)));
    }

    [TestFixture]
    public class GivenASlashVendorPrefix
    {
        [Test]
        public void TheVendorIsRemoved()
            => Assert.That(ModelIdDecorations.StripSlashVendorPrefix("mistralai/mistral-large").Name, Is.EqualTo("mistral-large"));

        [Test]
        public void TheVendorBecomesTheHint()
            => Assert.That(ModelIdDecorations.StripSlashVendorPrefix("mistralai/mistral-large").VendorHint, Is.EqualTo("mistralai"));

        [TestCase("/model")]
        [TestCase("vendor/")]
        public void ADanglingSlashChangesNothing(string input)
            => Assert.That(ModelIdDecorations.StripSlashVendorPrefix(input), Is.EqualTo(new StrippedModelId(input, null)));
    }

    [TestFixture]
    public class GivenAVersionSuffix
    {
        [TestCase("claude-x-v1:0", "claude-x")]
        [TestCase("claude-x-v2:0", "claude-x")]
        [TestCase("claude-x:0", "claude-x")]
        [TestCase("claude-x:1", "claude-x")]
        [TestCase("claude-x", "claude-x")]
        public void ItIsRemoved(string input, string expected)
            => Assert.That(ModelIdDecorations.StripVersionSuffix(input).Name, Is.EqualTo(expected));
    }

    [TestFixture]
    public class GivenAColonSuffix
    {
        [TestCase("claude-x-v1:0", "claude-x-v1")]
        [TestCase("claude-x:1", "claude-x")]
        [TestCase("claude-x-v1", "claude-x-v1")]
        public void OnlyTheColonPartIsRemoved(string input, string expected)
            => Assert.That(ModelIdDecorations.StripColonSuffix(input), Is.EqualTo(expected));
    }

    [TestFixture]
    public class GivenADateStamp
    {
        [TestCase("gpt-4o-20250101", "gpt-4o")]
        [TestCase("gpt-4o-2025-01-01", "gpt-4o")]
        [TestCase("gpt-4o", "gpt-4o")]
        [TestCase("gpt-4o-2025", "gpt-4o-2025")]
        public void OnlyAFullDateIsRemoved(string input, string expected)
            => Assert.That(ModelIdDecorations.StripDateStamp(input), Is.EqualTo(expected));
    }

    [TestFixture]
    public class GivenACombinedBedrockId
    {
        private StrippedModelId _result;

        [SetUp]
        public void SetUp() => _result = ModelIdDecorations.Strip("us.anthropic.claude-sonnet-4-5-20250929-v1:0");

        [Test]
        public void TheDecorationsAreRemoved()
            => Assert.That(_result.Name, Is.EqualTo("claude-sonnet-4-5-20250929"));

        [Test]
        public void TheVendorIsTheHint()
            => Assert.That(_result.VendorHint, Is.EqualTo("anthropic"));
    }

    [Test]
    public void AnUndecoratedIdIsUnchanged()
        => Assert.That(ModelIdDecorations.Strip("  gpt-4o "), Is.EqualTo(new StrippedModelId("gpt-4o", null)));
}
