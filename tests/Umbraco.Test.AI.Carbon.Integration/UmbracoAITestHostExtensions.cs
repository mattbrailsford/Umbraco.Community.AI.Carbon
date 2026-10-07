using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Umbraco.Community.AI.Carbon.Tests.Integration;

internal static class UmbracoAITestHostExtensions
{
    /// <summary>
    /// Removes Umbraco.AI's background jobs from a Management API test host.
    /// </summary>
    /// <remarks>
    /// On CMS 17 the host instantiates every hosted service before the test base has pointed the application at its
    /// per-test database (<c>UseTestDatabase</c> runs in a hosted service's <c>StartingAsync</c>). Umbraco.AI's jobs depend on
    /// its EF Core repositories, so they make EF Core build (and cache) the <c>UmbracoAIDbContext</c> options while the
    /// connection string is still empty, and every query then fails with "No database provider has been configured".
    /// The jobs (usage roll-ups, clean-ups, the task queue) have no part in these tests, which seed the usage tables directly.
    /// </remarks>
    public static IServiceCollection RemoveUmbracoAIBackgroundJobs(this IServiceCollection services)
    {
        foreach (var descriptor in services
                     .Where(d => d.ServiceType == typeof(IHostedService)
                                 && d.ImplementationType?.Namespace?.StartsWith("Umbraco.AI.") == true)
                     .ToList())
        {
            services.Remove(descriptor);
        }

        return services;
    }
}
