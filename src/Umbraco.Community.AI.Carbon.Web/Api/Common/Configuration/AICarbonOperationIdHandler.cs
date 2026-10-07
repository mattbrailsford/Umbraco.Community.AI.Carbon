using Asp.Versioning;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Api.Common.OpenApi;
using Umbraco.Extensions;

namespace Umbraco.Community.AI.Carbon.Web.Api.Common.Configuration;

/// <summary>
/// Operation ID handler for this package's Management API: the action name with its first letter lower-cased
/// (<c>GetEstimate</c> becomes <c>getEstimate</c>), which is what the generated frontend client's method names derive from.
/// Umbraco's default handler only claims <c>Umbraco.Cms</c> controllers, so ours would otherwise fall through to a
/// route-derived name.
/// </summary>
internal class AICarbonOperationIdHandler(IOptions<ApiVersioningOptions> apiVersioningOptions)
    : OperationIdHandler(apiVersioningOptions)
{
    /// <inheritdoc />
    protected override bool CanHandle(ApiDescription apiDescription, ControllerActionDescriptor controllerActionDescriptor)
        => AICarbonNamespace.Owns(controllerActionDescriptor.ControllerTypeInfo.Namespace);

    /// <inheritdoc />
    public override string Handle(ApiDescription apiDescription)
        => $"{apiDescription.ActionDescriptor.RouteValues["action"]}".ToFirstLower();
}
