using Microsoft.AspNetCore.Mvc;
using Umbraco.Community.AI.Carbon.Web.Api.Common.Controllers;
using Umbraco.Community.AI.Carbon.Web.Api.Common.Routing;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate;

/// <summary>
/// Base controller for the estimate Management API endpoints.
/// </summary>
[ApiExplorerSettings(GroupName = Constants.Estimate.GroupName)]
[AICarbonVersionedManagementApiRoute(Constants.Estimate.RouteSegment)]
public abstract class EstimateControllerBase : AICarbonManagementControllerBase
{
    /// <summary>
    /// Returns a 400 Bad Request whose problem details name the offending field.
    /// </summary>
    /// <param name="field">The query field at fault.</param>
    /// <param name="message">What is wrong with it.</param>
    /// <returns>A 400 Bad Request result.</returns>
    protected IActionResult InvalidField(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }
}
