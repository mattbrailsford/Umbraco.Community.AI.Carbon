namespace Umbraco.Community.AI.Carbon.Web;

/// <summary>
/// Constants for the Umbraco AI Carbon Management API.
/// </summary>
public static class Constants
{
    /// <summary>
    /// The namespace root of this package, used to claim its controllers and types for the OpenAPI handlers.
    /// </summary>
    internal const string NamespaceRoot = "Umbraco.Community.AI.Carbon";

    /// <summary>
    /// The Management API name, used for the OpenAPI document and route segment.
    /// </summary>
    public const string ManagementApiName = "ai-carbon-management";

    /// <summary>
    /// The Management API title, shown in the OpenAPI document and Swagger UI.
    /// </summary>
    public const string ManagementApiTitle = "Umbraco AI Carbon Management API";

    /// <summary>
    /// The API root path, relative to the backoffice path (<c>/umbraco</c>).
    /// </summary>
    public const string ManagementApiBackofficePath = "/ai-carbon/management/api";

    /// <summary>
    /// Defines constants for the estimate feature area of the Management API.
    /// </summary>
    public static class Estimate
    {
        /// <summary>
        /// The route segment for the estimate endpoint.
        /// </summary>
        public const string RouteSegment = "estimate";

        /// <summary>
        /// The Swagger group name for the estimate endpoint.
        /// </summary>
        public const string GroupName = "Estimate";
    }
}
