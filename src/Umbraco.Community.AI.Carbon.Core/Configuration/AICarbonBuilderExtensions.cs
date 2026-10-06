using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Estimation;
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
        // Safe to call more than once (the composer and a site's own Program.cs may both call it).
        // Keyed on a type only this package registers: a developer replacing a public service must
        // not make the rest of the registration look already done.
        if (builder.Services.Any(x => x.ServiceType == typeof(AICarbonMarker)))
        {
            return builder;
        }

        builder.Services.AddSingleton<AICarbonMarker>();

        builder.Services.AddOptions<AICarbonOptions>().Bind(builder.Config.GetSection(AICarbonOptions.SectionName));

        builder.Services.AddSingleton<IEcoLogitsDataRepository>(_ => EcoLogitsDataRepository.LoadEmbedded());

        // Singletons: all stateless or reading IOptionsMonitor, and Umbraco.AI registers
        // IAIUsageAnalyticsService as a singleton too, so nothing scoped is captured.
        builder.Services.AddSingleton<ICarbonFactorCalculator, CarbonFactorCalculator>();
        builder.Services.AddSingleton<ModelFactorResolver>();

        // TryAdd: a developer's own IAICarbonEstimateService wins whichever composer runs first.
        builder.Services.TryAddSingleton<IAICarbonEstimateService, AICarbonEstimateService>();

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
