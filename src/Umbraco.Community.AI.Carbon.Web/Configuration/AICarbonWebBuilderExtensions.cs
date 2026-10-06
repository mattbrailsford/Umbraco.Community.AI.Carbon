using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Api.Common.DependencyInjection;
using Umbraco.Cms.Api.Common.OpenApi;
using Umbraco.Cms.Api.Management.OpenApi;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Mapping;
using Umbraco.Community.AI.Carbon.Web;
using Umbraco.Community.AI.Carbon.Web.Api.Common.Configuration;
using Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Mapping;

namespace Umbraco.Community.AI.Carbon.Extensions;

/// <summary>
/// Extension methods for <see cref="IUmbracoBuilder"/> for Umbraco AI Carbon web/Management API registration.
/// </summary>
public static class AICarbonWebBuilderExtensions
{
    /// <summary>
    /// Registers the Umbraco AI Carbon Management API: the OpenAPI document, its JSON options and the map
    /// definitions. Authorization uses Umbraco.AI's own <c>SectionAccessAI</c> policy, which Umbraco.AI registers.
    /// </summary>
    /// <param name="builder">The Umbraco builder.</param>
    /// <returns>The builder, for chaining.</returns>
    public static IUmbracoBuilder AddAICarbonWeb(this IUmbracoBuilder builder)
    {
        builder.Services.AddControllers()
            .AddJsonOptions(Constants.ManagementApiName, options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
                options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });

        builder.AddBackOfficeOpenApiDocument(Constants.ManagementApiName, document =>
        {
            document
                .WithTitle(Constants.ManagementApiTitle)
                .WithUiTitle(Constants.ManagementApiTitle)
                .WithJsonOptions(Constants.ManagementApiName)
                .WithBackOfficeAuthentication();
        });

        // Schema generation reads the named *HTTP* JsonOptions, not the MVC ones above: bridge them.
        builder.Services.AddSingleton<IConfigureOptions<Microsoft.AspNetCore.Http.Json.JsonOptions>>(
            sp => new ConfigureAICarbonHttpJsonOptions(
                Constants.ManagementApiName,
                sp.GetRequiredService<IOptionsMonitor<Microsoft.AspNetCore.Mvc.JsonOptions>>()));

        builder.WithCollectionBuilder<MapDefinitionCollectionBuilder>()
            .Add<EstimateMapDefinition>();

        return builder;
    }
}
