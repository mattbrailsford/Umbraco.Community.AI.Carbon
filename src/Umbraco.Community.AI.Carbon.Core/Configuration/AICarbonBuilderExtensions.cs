using Umbraco.Cms.Core.DependencyInjection;

namespace Umbraco.Community.AI.Carbon.Extensions;

/// <summary>
/// Extension methods for <see cref="IUmbracoBuilder"/> for Umbraco AI Carbon registration.
/// </summary>
public static class AICarbonBuilderExtensions
{
    /// <summary>
    /// Registers Umbraco AI Carbon's services.
    /// </summary>
    /// <param name="builder">The Umbraco builder.</param>
    /// <returns>The Umbraco builder.</returns>
    public static IUmbracoBuilder AddAICarbon(this IUmbracoBuilder builder)
    {
        // Services are registered here as features are built.
        return builder;
    }
}
