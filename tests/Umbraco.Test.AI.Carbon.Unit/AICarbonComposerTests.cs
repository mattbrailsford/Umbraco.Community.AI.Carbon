using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Core.Configuration;

namespace Umbraco.Community.AI.Carbon.Tests.Unit;

[TestFixture]
public class AICarbonComposerTests
{
    [Test]
    public void Composer_Is_Discoverable_By_Umbraco()
        => Assert.That(typeof(AICarbonComposer).IsPublic, Is.True);
}
