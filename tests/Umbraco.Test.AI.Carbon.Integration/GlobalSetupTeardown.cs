using NUnit.Framework;
using Umbraco.Cms.Tests.Integration.Testing;

// ReSharper disable once CheckNamespace -- deliberately no namespace, so this applies to the whole
// assembly, matching Umbraco.Cms.Tests.Integration's own GlobalSetupTeardown convention. That one
// lives in its own NuGet package assembly, so its [SetUpFixture] never runs for this assembly --
// without a copy here, the pooled SQLite test databases UmbracoIntegrationTest creates are never
// torn down at the end of a test run.
[SetUpFixture]
public class GlobalSetupTeardown
{
    [OneTimeTearDown]
    public void TearDown() => BaseTestDatabase.Instance?.TearDown();
}
