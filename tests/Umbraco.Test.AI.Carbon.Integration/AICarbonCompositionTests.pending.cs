// S1 — wire: estimate services into AICarbonComposer. Task: T6.
using NUnit.Framework;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Tests.Common.Testing;
using Umbraco.Cms.Tests.Integration.Testing;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Extensions;

namespace Umbraco.Community.AI.Carbon.Tests.Integration;

[TestFixture]
[UmbracoTest(Database = UmbracoTestOptions.Database.NewSchemaPerFixture)]
public class AICarbonCompositionTests : UmbracoIntegrationTest
{
    // TODO(T6): also register Umbraco.AI's core services here (its IUmbracoBuilder extension),
    // since the estimate service depends on IAIUsageAnalyticsService.
    protected override void CustomTestSetup(IUmbracoBuilder builder) => builder.AddAICarbon();

    [Test]
    public void ResolvesTheEstimateServiceFromTheContainer()
        => Assert.That(GetRequiredService<IAICarbonEstimateService>(), Is.Not.Null);
}
