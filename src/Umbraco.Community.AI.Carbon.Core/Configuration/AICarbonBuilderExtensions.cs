using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Resolution;

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
    /// <returns>The same builder, for chaining.</returns>
    public static IUmbracoBuilder AddAICarbon(this IUmbracoBuilder builder)
    {
        builder.Services.AddOptions<AICarbonOptions>().Bind(builder.Config.GetSection(AICarbonOptions.SectionName));

        builder.Services.AddSingleton<IEcoLogitsDataRepository>(_ => EcoLogitsDataRepository.LoadEmbedded());

        builder.AICarbonModelResolvers()
            .Append<ConfiguredMappingResolver>()
            .Append<DirectProviderResolver>()
            .Append<NormalizedNameResolver>();

        builder.Services.AddSingleton<AICarbonOptionsValidator>();
        builder.AddNotificationHandler<UmbracoApplicationStartingNotification, AICarbonOptionsValidationHandler>();

        return builder;
    }

    /// <summary>
    /// Gets the collection builder for the chain of model resolvers. Use <c>Insert&lt;T&gt;()</c>,
    /// <c>Append&lt;T&gt;()</c> and <c>Remove&lt;T&gt;()</c> to customise how Umbraco.AI models are
    /// matched to EcoLogits models.
    /// </summary>
    /// <param name="builder">The Umbraco builder.</param>
    /// <returns>The model resolver collection builder.</returns>
    public static AICarbonModelResolverCollectionBuilder AICarbonModelResolvers(this IUmbracoBuilder builder)
        => builder.WithCollectionBuilder<AICarbonModelResolverCollectionBuilder>();
}
