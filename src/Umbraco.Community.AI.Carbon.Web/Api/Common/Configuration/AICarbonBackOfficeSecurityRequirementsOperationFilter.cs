using Umbraco.Cms.Api.Management.OpenApi;

namespace Umbraco.Community.AI.Carbon.Web.Api.Common.Configuration;

/// <summary>
/// Operation filter that applies the back-office security requirements (the 401 response and the bearer
/// requirement) to this package's Management API operations.
/// </summary>
/// <param name="apiName">The Swagger document (and <c>[MapToApi]</c> name) this filter applies to.</param>
internal sealed class AICarbonBackOfficeSecurityRequirementsOperationFilter(string apiName)
    : BackOfficeSecurityRequirementsOperationFilterBase
{
    /// <inheritdoc />
    protected override string ApiName => apiName;
}
