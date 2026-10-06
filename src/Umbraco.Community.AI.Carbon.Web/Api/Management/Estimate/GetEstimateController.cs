using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Web.Authorization;
using Umbraco.Cms.Core.Mapping;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate;

/// <summary>
/// Controller to get the estimated CO2e of Umbraco.AI usage in a period.
/// </summary>
[ApiVersion("1.0")]
[Authorize(Policy = AIAuthorizationPolicies.SectionAccessAI)]
public class GetEstimateController : EstimateControllerBase
{
    private readonly IAICarbonEstimateService _estimateService;
    private readonly IUmbracoMapper _umbracoMapper;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetEstimateController"/> class.
    /// </summary>
    /// <param name="estimateService">Estimates the CO2e of recorded usage.</param>
    /// <param name="umbracoMapper">Maps the estimate to the API response model.</param>
    public GetEstimateController(IAICarbonEstimateService estimateService, IUmbracoMapper umbracoMapper)
    {
        _estimateService = estimateService;
        _umbracoMapper = umbracoMapper;
    }

    /// <summary>
    /// Get the estimated CO2e of Umbraco.AI usage in a period. Times without an offset are taken as UTC.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <param name="from">Start of the period (inclusive, ISO 8601).</param>
    /// <param name="to">End of the period (exclusive, ISO 8601).</param>
    /// <param name="granularity">Optional bucket size (Hourly or Daily). When omitted, the same automatic choice Umbraco.AI makes.</param>
    /// <returns>The estimate.</returns>
    [HttpGet]
    [MapToApiVersion("1.0")]
    [ProducesResponseType(typeof(EstimateResponseModel), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)] // 401 is added to every protected operation by Umbraco's OpenAPI transformer; 403 only for 3+ Authorize attributes, and this has 2.
    public async Task<IActionResult> GetEstimate(
        CancellationToken cancellationToken,
        [BindRequired] DateTime from,
        [BindRequired] DateTime to,
        AIUsagePeriod? granularity = null)
    {
        if (EstimateRequestValidator.Validate(from, to, granularity) is { } problem)
        {
            return InvalidField(problem.Field, problem.Message);
        }

        try
        {
            var estimate = await _estimateService.GetEstimateAsync(from, to, granularity, cancellationToken);
            return Ok(_umbracoMapper.Map<EstimateResponseModel>(estimate));
        }
        catch (ArgumentException ex) when (ex.ParamName is "from" or "to")
        {
            // Safety net for the service's own window checks (it names the argument at fault). The validator
            // mirrors them, so this only fires if they drift apart. Any other ArgumentException is a bug: a 500.
            return InvalidField(ex.ParamName ?? "request", ex.Message);
        }
    }
}
