using System.Reflection;
using Microsoft.Extensions.Configuration;
using NUnit.Framework;
using Umbraco.Cms.Tests.Integration.Testing;
using Umbraco.Cms.Tests.Integration.TestServerTest;

// ReSharper disable once CheckNamespace -- deliberately no namespace, so this applies to the whole
// assembly, matching Umbraco.Cms.Tests.Integration's own GlobalSetupTeardown convention. That one
// lives in its own NuGet package assembly, so its [SetUpFixture] never runs for this assembly --
// without a copy here, the pooled SQLite test databases UmbracoIntegrationTest creates are never
// torn down at the end of a test run.
[SetUpFixture]
public class GlobalSetupTeardown
{
    // What Umbraco.Cms.Tests.Integration's own GlobalSetupTeardown would load from its appsettings.Tests.json.
    private static readonly Dictionary<string, string?> TestDatabaseSettings = new()
    {
        ["Tests:Database:DatabaseType"] = "Sqlite",
        ["Tests:Database:PrepareThreadCount"] = "1",
        ["Tests:Database:SchemaDatabaseCount"] = "1",
        ["Tests:Database:EmptyDatabasesCount"] = "1",
    };

    // UmbracoTestServerTestBase (used by the Management API tests) adds the other assembly's static
    // GlobalSetupTeardown.TestConfiguration to its host unguarded, and that is null here because its
    // [SetUpFixture] never runs. Provide it, through the only way in: its private setter.
    [OneTimeSetUp]
    public void ProvideTestConfiguration()
    {
        var umbracoSetup = typeof(UmbracoTestServerTestBase).Assembly.GetType("GlobalSetupTeardown", throwOnError: true)!;
        var property = umbracoSetup.GetProperty("TestConfiguration", BindingFlags.Public | BindingFlags.Static)!;
        property.SetValue(null, new ConfigurationBuilder().AddInMemoryCollection(TestDatabaseSettings).Build());
    }

    [OneTimeTearDown]
    public void TearDown() => BaseTestDatabase.Instance?.TearDown();
}
