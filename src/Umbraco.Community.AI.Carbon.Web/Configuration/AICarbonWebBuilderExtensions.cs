using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;
using Umbraco.Cms.Api.Common.DependencyInjection;
using Umbraco.Cms.Api.Common.OpenApi;
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
    /// Registers the Umbraco AI Carbon Management API: the Swagger document, its JSON options and the map
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

        builder.Services.Configure<SwaggerGenOptions>(options =>
        {
            // Only add the document if it hasn't been added already (composers can run more than once in tests).
            if (options.SwaggerGeneratorOptions.SwaggerDocs.ContainsKey(Constants.ManagementApiName))
            {
                return;
            }

            options.SwaggerDoc(
                Constants.ManagementApiName,
                new OpenApiInfo
                {
                    Title = Constants.ManagementApiTitle,
                    Version = "Latest",
                });

            options.DocumentFilter<MimeTypeDocumentFilter>(Constants.ManagementApiName);
            options.OperationFilter<AICarbonBackOfficeSecurityRequirementsOperationFilter>(Constants.ManagementApiName);
        });

        builder.Services.AddSingleton<IOperationIdHandler, AICarbonOperationIdHandler>();
        builder.Services.AddSingleton<ISchemaIdHandler, AICarbonSchemaIdHandler>();

        builder.WithCollectionBuilder<MapDefinitionCollectionBuilder>()
            .Add<EstimateMapDefinition>();

        return builder;
    }
}
