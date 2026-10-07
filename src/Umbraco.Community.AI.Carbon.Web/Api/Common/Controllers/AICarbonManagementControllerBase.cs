using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Api.Common.Attributes;
using Umbraco.Cms.Api.Common.Filters;
using Umbraco.Cms.Web.Common.Authorization;
using Umbraco.Cms.Web.Common.Filters;

namespace Umbraco.Community.AI.Carbon.Web.Api.Common.Controllers;

/// <summary>
/// Base controller for every Umbraco AI Carbon Management API controller. Section access (Umbraco.AI's
/// <c>SectionAccessAI</c> policy) is applied per controller, as Umbraco.AI's own controllers do.
/// </summary>
[ApiController]
[Authorize(Policy = AuthorizationPolicies.BackOfficeAccess)]
[DisableBrowserCache]
[Produces("application/json")]
[MapToApi(Constants.ManagementApiName)]
[JsonOptionsName(Constants.ManagementApiName)]
public abstract class AICarbonManagementControllerBase : ControllerBase
{
}
