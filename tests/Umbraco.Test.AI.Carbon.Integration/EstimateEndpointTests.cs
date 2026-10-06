// S1 (AC9), S9 (AC1–AC3) — wire: GET /estimate into the Management API. Task: T11.
using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Extensions;
using Umbraco.AI.Persistence.Notifications;
using Umbraco.Cms.Api.Management.Controllers.Security;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Mapping;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Infrastructure.Persistence;
using Umbraco.Cms.Tests.Integration.ManagementApi;
using Umbraco.Community.AI.Carbon.Core;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Extensions;
using Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate;
using Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;
using CarbonWebConstants = Umbraco.Community.AI.Carbon.Web.Constants;

namespace Umbraco.Community.AI.Carbon.Tests.Integration;

[TestFixture]
public class EstimateEndpointTests : ManagementApiTest<BackOfficeController>
{
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    // ManagementApiTest<T> only accepts Umbraco's own ManagementApiControllerBase controllers, which ours
    // deliberately isn't (it is its own API, like Umbraco.AI's). T is just a stand-in for the sign-in helpers
    // it provides, so MethodSelector is never used to find our endpoint: the route is spelled out instead,
    // which also makes it a test of the URL the frontend calls.
    protected override Expression<Func<BackOfficeController, object>> MethodSelector { get; set; }
        = x => x.Login(CancellationToken.None, null!);

    private static readonly string BaseUrl = $"/umbraco{CarbonWebConstants.ManagementApiBackofficePath}/v1/{CarbonWebConstants.Estimate.RouteSegment}";

    private static readonly string DefaultQuery = $"from={From:O}&to={From.AddDays(7):O}";

    // The test host skips composers, so register what a site gets from its composers: Umbraco.AI (core and
    // web, which provides the SectionAccessAI policy), this package, and this package's Management API.
    protected override void CustomTestSetup(IUmbracoBuilder builder)
    {
        base.CustomTestSetup(builder);
        builder.AddUmbracoAI();
        builder.AddAICarbon();
        builder.AddAICarbonWeb();
    }

    // The controllers live in this package's Web assembly, which the test host doesn't scan on its own.
    protected override void CustomMvcSetup(IMvcBuilder mvcBuilder)
    {
        base.CustomMvcSetup(mvcBuilder);
        mvcBuilder.AddApplicationPart(typeof(GetEstimateController).Assembly);
    }

    // Umbraco.AI creates its tables, and grants the AI section to the admin group, in a migration it runs
    // once the application has started, which the test host never signals. Run it against the test database.
    [SetUp]
    public async Task MigrateUmbracoAIDatabase()
    {
        var databaseFactory = GetRequiredService<IUmbracoDatabaseFactory>();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:umbracoDbDSN"] = databaseFactory.ConnectionString,
                ["ConnectionStrings:umbracoDbDSN_ProviderName"] = databaseFactory.ProviderName,
            })
            .Build();

        await new RunAIMigrationNotificationHandler(configuration, NullLogger<RunAIMigrationNotificationHandler>.Instance)
            .HandleAsync(new UmbracoApplicationStartedNotification(isRestarting: false), CancellationToken.None);
    }

    [Test]
    public async Task ReturnsOkForAnAdminWithAiSectionAccess()
    {
        await AuthenticateClientAsync(Client, "admin@umbraco.com", "1234567890", isAdmin: true);
        var response = await Client.GetAsync($"{BaseUrl}?{DefaultQuery}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task ReturnsUnauthorizedWhenNotSignedIn()
    {
        var response = await Client.GetAsync($"{BaseUrl}?{DefaultQuery}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task ReturnsForbiddenForAUserWithoutAiSectionAccess()
    {
        await AuthenticateClientAsync(Client, "writer@umbraco.com", "1234567890", Constants.Security.WriterGroupKey);
        var response = await Client.GetAsync($"{BaseUrl}?{DefaultQuery}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [Test]
    public async Task ReturnsBadRequestWhenFromIsAfterTo()
    {
        var response = await GetAsAdminAsync($"from={From.AddDays(7):O}&to={From:O}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
    }

    [Test]
    public async Task NamesTheFromFieldWhenFromIsAfterTo()
    {
        var response = await GetAsAdminAsync($"from={From.AddDays(7):O}&to={From:O}");
        Assert.That(await ErrorFieldsAsync(response), Does.Contain("from"));
    }

    [Test]
    public async Task ReturnsBadRequestWhenFromIsMissing()
    {
        var response = await GetAsAdminAsync($"to={From:O}");
        Assert.That(await ErrorFieldsAsync(response), Does.Contain("from"));
    }

    [Test]
    public async Task ReturnsBadRequestWhenToIsMissing()
    {
        var response = await GetAsAdminAsync($"from={From:O}");
        Assert.That(await ErrorFieldsAsync(response), Does.Contain("to"));
    }

    [Test]
    public async Task ReturnsBadRequestWhenGranularityIsNotKnown()
    {
        var response = await GetAsAdminAsync($"from={From:O}&to={From.AddDays(1):O}&granularity=Weekly");
        Assert.That(await ErrorFieldsAsync(response), Does.Contain("granularity"));
    }

    [Test]
    public async Task ReturnsBadRequestWhenTheWindowIsOverTheHourlyLimit()
    {
        var response = await GetAsAdminAsync($"from={From:O}&to={From.AddDays(94):O}&granularity=Hourly");
        Assert.That(await ErrorFieldsAsync(response), Does.Contain("to"));
    }

    [Test]
    public async Task AcceptsTheLongestHourlyWindow()
    {
        var response = await GetAsAdminAsync($"from={From:O}&to={From.AddDays(93):O}&granularity=Hourly");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task ReturnsBadRequestWhenTheWindowIsOverTheDailyLimit()
    {
        var response = await GetAsAdminAsync($"from={From:O}&to={From.AddDays(1831):O}&granularity=Daily");
        Assert.That(await ErrorFieldsAsync(response), Does.Contain("to"));
    }

    [Test]
    public async Task ReturnsBadRequestWhenTheEndIsTooCloseToTheEndOfTime()
    {
        var response = await GetAsAdminAsync($"from={From:O}&to={DateTime.MaxValue.AddHours(-12):O}&granularity=Daily");
        Assert.That(await ErrorFieldsAsync(response), Does.Contain("to"));
    }

    [Test]
    public async Task TakesDatesWithoutAnOffsetAsUtc()
    {
        var json = await GetJsonAsAdminAsync("from=2026-10-01T00:00:00&to=2026-10-02T00:00:00");
        Assert.That(json.RootElement.GetProperty("from").GetString(), Is.EqualTo("2026-10-01T00:00:00Z"));
    }

    [Test]
    public async Task ReportsTheEcoLogitsDataVersion()
    {
        var json = await GetJsonAsAdminAsync();
        Assert.That(json.RootElement.GetProperty("method").GetProperty("dataVersion").GetString(), Is.EqualTo("0.11.2"));
    }

    [Test]
    public async Task ReturnsTheGranularityAsAString()
    {
        var json = await GetJsonAsAdminAsync();
        Assert.That(json.RootElement.GetProperty("granularity").GetString(), Is.EqualTo("Hourly"));
    }

    [Test]
    public async Task ReturnsTheTotalCo2eAsAMinMaxRange()
    {
        var json = await GetJsonAsAdminAsync();
        Assert.That(json.RootElement.GetProperty("total").GetProperty("co2eGrams").GetProperty("min").GetDouble(), Is.Zero);
    }

    [Test]
    public async Task ReturnsWhetherTheFeatureSplitIsAvailable()
    {
        var json = await GetJsonAsAdminAsync();
        Assert.That(json.RootElement.GetProperty("byFeature").TryGetProperty("available", out _), Is.True);
    }

    [Test]
    public async Task ReturnsOneTimeSeriesPointPerHourOfTheWindow()
    {
        var json = await GetJsonAsAdminAsync();
        Assert.That(json.RootElement.GetProperty("timeSeries").GetArrayLength(), Is.EqualTo(7 * 24));
    }

    [Test]
    public async Task WritesTimeSeriesTimestampsAsUtcWithAZ()
    {
        var json = await GetJsonAsAdminAsync();
        Assert.That(json.RootElement.GetProperty("timeSeries")[0].GetProperty("timestamp").GetString(), Does.EndWith("Z"));
    }

    // The mapper is exercised with usage here because the host's analytics are empty, so the HTTP tests above
    // only ever see empty rows. Serialised with the document's own JSON options, as the controller does.
    [Test]
    public void MapsAnEstimatedRowsStatusAsAString()
        => Assert.That(Row(0).GetProperty("status").GetString(), Is.EqualTo("Estimated"));

    [Test]
    public void MapsAnEstimatedRowsMatchedModel()
        => Assert.That(Row(0).GetProperty("matchedAs").GetString(), Is.EqualTo("openai/gpt-4o"));

    [Test]
    public void MapsAnEstimatedRowsElectricityZone()
        => Assert.That(Row(0).GetProperty("electricityZone").GetString(), Is.EqualTo("USA"));

    [Test]
    public void MapsAnEstimatedRowsCo2eMinimum()
        => Assert.That(Row(0).GetProperty("co2eGrams").GetProperty("min").GetDouble(), Is.EqualTo(1.5));

    [Test]
    public void MapsAnEstimatedRowsCo2eMaximum()
        => Assert.That(Row(0).GetProperty("co2eGrams").GetProperty("max").GetDouble(), Is.EqualTo(4.5));

    [Test]
    public void MapsAnEstimatedRowsWarnings()
        => Assert.That(Row(0).GetProperty("warnings")[0].GetString(), Is.EqualTo("model-arch-not-released"));

    [Test]
    public void MapsAnEstimatedRowsRequestCountAsANumber()
        => Assert.That(Row(0).GetProperty("requests").GetInt64(), Is.EqualTo(12));

    [Test]
    public void MapsAnUnknownModelRowsStatusAsAString()
        => Assert.That(Row(1).GetProperty("status").GetString(), Is.EqualTo("UnknownModel"));

    [Test]
    public void MapsAnUnknownModelRowsCo2eAsNull()
        => Assert.That(Row(1).GetProperty("co2eGrams").ValueKind, Is.EqualTo(JsonValueKind.Null));

    [Test]
    public void MapsAnUnknownModelRowsMatchedModelAsNull()
        => Assert.That(Row(1).GetProperty("matchedAs").ValueKind, Is.EqualTo(JsonValueKind.Null));

    [Test]
    public void MapsAnUnknownModelRowsElectricityZoneAsNull()
        => Assert.That(Row(1).GetProperty("electricityZone").ValueKind, Is.EqualTo(JsonValueKind.Null));

    [Test]
    public void MapsAFeatureItem()
    {
        var item = MappedEstimate().RootElement.GetProperty("byFeature").GetProperty("items")[0];
        Assert.That(item.GetProperty("featureType").GetString(), Is.EqualTo("agent"));
    }

    [Test]
    public void MapsAFeatureItemsCo2eMaximum()
    {
        var item = MappedEstimate().RootElement.GetProperty("byFeature").GetProperty("items")[0];
        Assert.That(item.GetProperty("co2eGrams").GetProperty("max").GetDouble(), Is.EqualTo(3.0));
    }

    [Test]
    public void MapsTheNotEstimatedRequests()
        => Assert.That(MappedEstimate().RootElement.GetProperty("notEstimated").GetProperty("requests").GetInt64(), Is.EqualTo(3));

    [Test]
    public void MapsTheNotEstimatedModels()
        => Assert.That(MappedEstimate().RootElement.GetProperty("notEstimated").GetProperty("models").GetInt32(), Is.EqualTo(1));

    [Test]
    public void MapsTheMethodsElectricityZones()
        => Assert.That(
            MappedEstimate().RootElement.GetProperty("method").GetProperty("electricityZones").EnumerateArray().Select(z => z.GetString()),
            Is.EqualTo(new[] { "SWE", "USA" }));

    [Test]
    public void MapsTheMethodsElectricityZone()
        => Assert.That(MappedEstimate().RootElement.GetProperty("method").GetProperty("electricityZone").GetString(), Is.EqualTo("USA"));

    [Test]
    public void MapsTheGranularityAsAString()
        => Assert.That(MappedEstimate().RootElement.GetProperty("granularity").GetString(), Is.EqualTo("Daily"));

    private JsonElement Row(int index) => MappedEstimate().RootElement.GetProperty("byModel")[index];

    private JsonDocument MappedEstimate()
    {
        var estimate = new AICarbonEstimate(
            From,
            From.AddDays(1),
            AIUsagePeriod.Daily,
            new AICarbonTotal(new RangeValue(1.5, 4.5), new RangeValue(2, 6), 12, 900),
            [
                new AICarbonModelEstimate(
                    "openai",
                    "gpt-4o-2024-08-06",
                    "openai/gpt-4o",
                    "USA",
                    AICarbonEstimateStatus.Estimated,
                    new RangeValue(1.5, 4.5),
                    12,
                    900,
                    ["model-arch-not-released"]),
                new AICarbonModelEstimate(
                    "acme", "mystery-1", null, null, AICarbonEstimateStatus.UnknownModel, null, 3, 70, []),
            ],
            new AICarbonFeatureBreakdown(true, [new AICarbonFeatureEstimate("agent", new RangeValue(1, 3), 8)]),
            [new AICarbonTimeSeriesPoint(From, new RangeValue(1.5, 4.5))],
            new AICarbonNotEstimated(3, 70, 1),
            new AICarbonMethod(AICarbonMethod.EcoLogitsSource, "0.11.2", "USA", ["SWE", "USA"], true, true));

        var model = GetRequiredService<IUmbracoMapper>().Map<EstimateResponseModel>(estimate)!;
        var options = GetRequiredService<IOptionsMonitor<Microsoft.AspNetCore.Mvc.JsonOptions>>()
            .Get(CarbonWebConstants.ManagementApiName).JsonSerializerOptions;
        return JsonDocument.Parse(JsonSerializer.Serialize(model, options));
    }

    private async Task<HttpResponseMessage> GetAsAdminAsync(string query)
    {
        await AuthenticateClientAsync(Client, "admin@umbraco.com", "1234567890", isAdmin: true);
        return await Client.GetAsync($"{BaseUrl}?{query}");
    }

    private async Task<JsonDocument> GetJsonAsAdminAsync(string? query = null)
    {
        var response = await GetAsAdminAsync(query ?? DefaultQuery);
        var body = await response.Content.ReadAsStringAsync();
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        return JsonDocument.Parse(body);
    }

    private static async Task<IReadOnlyCollection<string>> ErrorFieldsAsync(HttpResponseMessage response)
    {
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        return problem!.Errors.Keys.Select(key => key.ToLowerInvariant()).ToList();
    }
}
