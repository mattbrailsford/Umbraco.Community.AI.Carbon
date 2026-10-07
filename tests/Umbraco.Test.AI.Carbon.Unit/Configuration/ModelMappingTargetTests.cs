using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Core.Configuration;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Configuration;

[TestFixture]
public class ModelMappingTargetTests
{
    [TestFixture]
    public class GivenAValidValue
    {
        [Test]
        public void It_Parses() => Assert.That(ModelMappingTarget.TryParse("openai/gpt-4o", out _), Is.True);

        [Test]
        public void Provider_Is_Before_The_Slash()
        {
            ModelMappingTarget.TryParse("openai/gpt-4o", out var target);
            Assert.That(target.Provider, Is.EqualTo("openai"));
        }

        [Test]
        public void Name_Is_After_The_Slash()
        {
            ModelMappingTarget.TryParse("openai/gpt-4o", out var target);
            Assert.That(target.Name, Is.EqualTo("gpt-4o"));
        }
    }

    [TestFixture]
    public class GivenANestedName
    {
        [Test]
        public void Name_Keeps_Later_Slashes()
        {
            ModelMappingTarget.TryParse("huggingface_hub/org/model", out var target);
            Assert.That(target.Name, Is.EqualTo("org/model"));
        }
    }

    [TestFixture]
    public class GivenSurroundingWhitespace
    {
        [Test]
        public void Provider_Is_Trimmed()
        {
            ModelMappingTarget.TryParse(" openai / gpt-4o ", out var target);
            Assert.That(target.Provider, Is.EqualTo("openai"));
        }

        [Test]
        public void Name_Is_Trimmed()
        {
            ModelMappingTarget.TryParse(" openai / gpt-4o ", out var target);
            Assert.That(target.Name, Is.EqualTo("gpt-4o"));
        }
    }

    [TestFixture]
    public class GivenAnInvalidValue
    {
        [TestCase(null)]
        [TestCase("")]
        [TestCase("   ")]
        [TestCase("gpt-4o")]
        [TestCase("openai/")]
        [TestCase("/gpt-4o")]
        [TestCase(" / ")]
        [TestCase("/")]
        public void It_Does_Not_Parse(string? value) => Assert.That(ModelMappingTarget.TryParse(value, out _), Is.False);
    }
}
