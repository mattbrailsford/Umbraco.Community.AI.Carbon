// S1 — wire: estimate services into AICarbonComposer. Task: T6.
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using Umbraco.AI.Extensions;
using Umbraco.AI.Persistence.Notifications;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Infrastructure.Persistence;
using Umbraco.Cms.Tests.Common.Testing;
using Umbraco.Cms.Tests.Integration.Testing;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Extensions;

namespace Umbraco.Community.AI.Carbon.Tests.Integration;

[TestFixture]
[UmbracoTest(Database = UmbracoTestOptions.Database.NewSchemaPerFixture)]
public class AICarbonCompositionTests : UmbracoIntegrationTest
{
    // The estimate service depends on IAIUsageAnalyticsService, so boot Umbraco.AI's real services
    // (what Umbraco.AI.Startup's composer does on a site) alongside this package's.
    protected override void CustomTestSetup(IUmbracoBuilder builder)
    {
        builder.AddUmbracoAI();
        builder.AddAICarbon();
    }

    // Umbraco.Cms.Tests.Integration's own GlobalSetupTeardown (which loads appsettings.Tests.json into
    // Tests:Database:*) lives in that NuGet package's assembly and never runs for this one; without
    // this, TestDatabaseFactory throws "Unsupported test database provider". Same as Content Checks.
    protected override void SetUpTestConfiguration(IConfigurationBuilder configBuilder)
    {
        base.SetUpTestConfiguration(configBuilder);
        configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Tests:Database:DatabaseType"] = "Sqlite",
            ["Tests:Database:PrepareThreadCount"] = "1",
            ["Tests:Database:SchemaDatabaseCount"] = "1",
            ["Tests:Database:EmptyDatabasesCount"] = "1",
        });
    }

    // Umbraco.AI creates its tables when the application has started, which the test host never
    // signals. Run its own migration handler against the test database so its usage tables exist.
    [SetUp]
    public async Task MigrateUmbracoAIDatabase()
    {
        var databaseFactory = GetRequiredService<IUmbracoDatabaseFactory>();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:umbracoDbDSN"] = databaseFactory.ConnectionString,
                ["ConnectionStrings:umbracoDbDSN_ProviderName"] = databaseFactory.ProviderName,
            })
            .Build();

        await new RunAIMigrationNotificationHandler(configuration, NullLogger<RunAIMigrationNotificationHandler>.Instance)
            .HandleAsync(new UmbracoApplicationStartedNotification(isRestarting: false), CancellationToken.None);
    }

    [Test]
    public void ResolvesTheEstimateServiceFromTheContainer()
        => Assert.That(GetRequiredService<IAICarbonEstimateService>(), Is.Not.Null);

    [Test]
    public async Task EstimatesAnEmptyPeriodAgainstUmbracoAIsRealAnalytics()
    {
        var to = DateTime.UtcNow;

        var estimate = await GetRequiredService<IAICarbonEstimateService>()
            .GetEstimateAsync(to.AddDays(-7), to, granularity: null);

        Assert.That(estimate.Total.Requests, Is.Zero);
    }
}
