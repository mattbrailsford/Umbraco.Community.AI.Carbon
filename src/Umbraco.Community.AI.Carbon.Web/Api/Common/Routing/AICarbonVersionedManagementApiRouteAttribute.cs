using Umbraco.Cms.Web.Common.Routing;

namespace Umbraco.Community.AI.Carbon.Web.Api.Common.Routing;

/// <summary>
/// Attribute for defining versioned Umbraco AI Carbon Management API routes.
/// </summary>
/// <param name="template">The route template.</param>
public class AICarbonVersionedManagementApiRouteAttribute(string template)
    : BackOfficeRouteAttribute($"{Constants.ManagementApiBackofficePath}/v{{version:apiVersion}}/{template.TrimStart('/')}");
