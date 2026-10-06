// S1 — the generated frontend client depends on this document. Task: T12.
using System.Linq.Expressions;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using NUnit.Framework;
using Umbraco.AI.Extensions;
using Umbraco.Cms.Api.Management.Controllers.Security;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Tests.Integration.ManagementApi;
using Umbraco.Community.AI.Carbon.Extensions;
using Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate;
using CarbonWebConstants = Umbraco.Community.AI.Carbon.Web.Constants;

namespace Umbraco.Community.AI.Carbon.Tests.Integration;

/// <summary>
/// The OpenAPI document is otherwise only generated on a running site (when someone runs
/// <c>npm run generate-client</c>), so a schema problem would go unnoticed until then.
/// </summary>
[TestFixture]
public class OpenApiDocumentTests : ManagementApiTest<BackOfficeController>
{
    // See EstimateEndpointTests: only here for the sign-in helpers the base class provides.
    protected override Expression<Func<BackOfficeController, object>> MethodSelector { get; set; }
        = x => x.Login(CancellationToken.None, null!);

    private static readonly string DocumentUrl = $"/umbraco/openapi/{CarbonWebConstants.ManagementApiName}.json";

    protected override void CustomTestSetup(IUmbracoBuilder builder)
    {
        base.CustomTestSetup(builder);

        // The Web composer already registers the OpenAPI document, so AddAICarbonWeb() must not be called here
        // (a second registration makes document generation fail). The two calls below are repeats of what
        // composers do, kept to mirror EstimateEndpointTests.
        builder.AddUmbracoAI();
        builder.AddAICarbon();
    }

    protected override void CustomMvcSetup(IMvcBuilder mvcBuilder)
    {
        base.CustomMvcSetup(mvcBuilder);
        mvcBuilder.AddApplicationPart(typeof(GetEstimateController).Assembly);
    }

    [Test]
    public async Task GeneratesTheDocument()
    {
        var response = await Client.GetAsync(DocumentUrl);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task DescribesTheEstimateOperationWithItsResponses()
    {
        using var document = await GetDocumentAsync();
        var responses = document.RootElement.GetProperty("paths")
            .GetProperty($"/umbraco{CarbonWebConstants.ManagementApiBackofficePath}/v1/{CarbonWebConstants.Estimate.RouteSegment}")
            .GetProperty("get").GetProperty("responses");

        Assert.That(responses.EnumerateObject().Select(response => response.Name), Is.EquivalentTo(new[] { "200", "400", "401", "403" }));
    }

    [Test]
    public async Task DescribesRequestCountsAsPlainIntegers()
    {
        using var document = await GetDocumentAsync();
        var requests = document.RootElement.GetProperty("components").GetProperty("schemas")
            .GetProperty("EstimateTotalModel").GetProperty("properties").GetProperty("requests");

        Assert.That(requests.GetProperty("type").GetString(), Is.EqualTo("integer"), requests.ToString());
    }

    [Test]
    public async Task DescribesTheEquivalentOnTheTotal()
    {
        using var document = await GetDocumentAsync();
        var properties = document.RootElement.GetProperty("components").GetProperty("schemas")
            .GetProperty("EstimateTotalModel").GetProperty("properties");

        Assert.That(properties.TryGetProperty("equivalent", out _), Is.True, properties.ToString());
    }

    private async Task<JsonDocument> GetDocumentAsync()
    {
        var response = await Client.GetAsync(DocumentUrl);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }
}
