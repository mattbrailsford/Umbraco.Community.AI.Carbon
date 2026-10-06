// S1 (AC9), S9 (AC1–AC3) — wire: GET /estimate into the Management API. Task: T11.
using System.Linq.Expressions;
using System.Net;
using NUnit.Framework;
using Umbraco.Cms.Core;
using Umbraco.Cms.Tests.Integration.ManagementApi;
using Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate;

namespace Umbraco.Community.AI.Carbon.Tests.Integration;

[TestFixture]
public class EstimateEndpointTests : ManagementApiTest<GetEstimateController>
{
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    protected override Expression<Func<GetEstimateController, object>> MethodSelector { get; set; }
        = x => x.GetEstimate(CancellationToken.None, From, From.AddDays(7), null);

    // TODO(T11): register Umbraco.AI (core + web, for the SectionAccessAI policy) and AddAICarbon()
    // in the test host, and grant the AI section to the admin group if it isn't granted by default.

    [Test]
    public async Task ReturnsOkForAnAdminWithAiSectionAccess()
    {
        await AuthenticateClientAsync(Client, "admin@umbraco.com", "1234567890", isAdmin: true);
        var response = await Client.GetAsync(Url);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task ReturnsUnauthorizedWhenNotSignedIn()
    {
        var response = await Client.GetAsync(Url);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task ReturnsForbiddenForAUserWithoutAiSectionAccess()
    {
        await AuthenticateClientAsync(Client, "writer@umbraco.com", "1234567890", Constants.Security.WriterGroupKey);
        var response = await Client.GetAsync(Url);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [Test]
    public async Task ReturnsBadRequestWhenFromIsAfterTo()
    {
        await AuthenticateClientAsync(Client, "admin@umbraco.com", "1234567890", isAdmin: true);
        var response = await Client.GetAsync(
            $"{Url.Split('?')[0]}?from={From.AddDays(7):O}&to={From:O}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
    }
}
