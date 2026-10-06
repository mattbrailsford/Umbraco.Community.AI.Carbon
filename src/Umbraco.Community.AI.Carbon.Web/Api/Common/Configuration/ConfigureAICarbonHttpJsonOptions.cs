using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Options;

namespace Umbraco.Community.AI.Carbon.Web.Api.Common.Configuration;

/// <summary>
/// Bridges the named MVC <see cref="Microsoft.AspNetCore.Mvc.JsonOptions"/> of this package's Management API
/// document into the matching named HTTP <see cref="JsonOptions"/>, which is what Microsoft.AspNetCore.OpenApi
/// reads to generate schemas. Without it, enums are documented as <c>integer</c> although the wire value is a
/// string, and 32/64-bit integers as <c>integer | string</c> with a pattern (so a generated TypeScript client
/// types them <c>number | string</c>). Mirrors Umbraco.AI's own bridge for its documents.
/// </summary>
internal sealed class ConfigureAICarbonHttpJsonOptions : IConfigureNamedOptions<JsonOptions>
{
    private readonly string _documentName;
    private readonly IOptionsMonitor<Microsoft.AspNetCore.Mvc.JsonOptions> _mvcJsonOptions;

    /// <summary>
    /// Initializes a new instance of the <see cref="ConfigureAICarbonHttpJsonOptions"/> class.
    /// </summary>
    /// <param name="documentName">The OpenAPI document (and named options) this instance mirrors.</param>
    /// <param name="mvcJsonOptions">The MVC JSON options to mirror from.</param>
    public ConfigureAICarbonHttpJsonOptions(
        string documentName,
        IOptionsMonitor<Microsoft.AspNetCore.Mvc.JsonOptions> mvcJsonOptions)
    {
        _documentName = documentName;
        _mvcJsonOptions = mvcJsonOptions;
    }

    /// <inheritdoc />
    public void Configure(JsonOptions options) => Configure(Options.DefaultName, options);

    /// <inheritdoc />
    public void Configure(string? name, JsonOptions options)
    {
        // Named options resolve this for every name; only mirror the document this instance owns.
        if (name != _documentName)
        {
            return;
        }

        var mvcOptions = _mvcJsonOptions.Get(_documentName);

        // Only the string-enum converter: the framework special-cases it to render a string enum schema.
        foreach (var converter in mvcOptions.JsonSerializerOptions.Converters)
        {
            if (converter is JsonStringEnumConverter)
            {
                options.SerializerOptions.Converters.Add(converter);
            }
        }

        options.SerializerOptions.PropertyNamingPolicy = mvcOptions.JsonSerializerOptions.PropertyNamingPolicy;

        // Plain numeric schemas instead of the framework default (a string with a numeric pattern).
        options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
    }
}
