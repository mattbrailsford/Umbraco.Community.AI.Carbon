using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

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

        builder.Services.AddSingleton<AICarbonOptionsValidator>();
        builder.AddNotificationHandler<UmbracoApplicationStartingNotification, AICarbonOptionsValidationHandler>();

        return builder;
    }
}
