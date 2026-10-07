using Umbraco.Cms.Api.Common.OpenApi;

namespace Umbraco.Community.AI.Carbon.Web.Api.Common.Configuration;

/// <summary>
/// Schema ID handler for this package's Management API. Applies Umbraco's schema naming convention
/// (a <c>Model</c> suffix, generics flattened) to our types, which Umbraco's default handler only does for
/// <c>Umbraco.Cms</c> types, so the generated client's type names stay stable.
/// </summary>
internal class AICarbonSchemaIdHandler : SchemaIdHandler
{
    /// <inheritdoc />
    public override bool CanHandle(Type type)
        => AICarbonNamespace.Owns(type.Namespace);
}
