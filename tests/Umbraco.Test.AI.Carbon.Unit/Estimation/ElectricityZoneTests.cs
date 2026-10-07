// S6 (AC1–AC4) — Electricity zone selection. Task: T9.
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using NUnit.Framework;
using Umbraco.AI.Core.Models;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Tests.Unit.Support;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class ElectricityZoneTests
{
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    private static FakeUsageAnalyticsService AnthropicUsage()
        => new FakeUsageAnalyticsService().Add(new UsageRow("anthropic", "claude-sonnet-4-5", AICapability.Chat, From.AddDays(1), 1, 1000));

    private static Task<AICarbonEstimate> EstimateAsync(string? zone)
        => EstimateServiceFactory.Create(AnthropicUsage(), electricityZone: zone).GetEstimateAsync(From, From.AddDays(7), null);

    private static FakeUsageAnalyticsService MistralUsage()
        => new FakeUsageAnalyticsService().Add(new UsageRow("mistral", "codestral-latest", AICapability.Chat, From.AddDays(1), 1, 1000));

    private static Task<AICarbonEstimate> EstimateOnAsync(IAICarbonEstimateService service)
        => service.GetEstimateAsync(From, From.AddDays(7), null);

    [TestFixture]
    public class GivenNoOverride
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp() => _estimate = await EstimateAsync(null);

        [Test]
        public void UsesTheProvidersDefaultZone()
            => Assert.That(_estimate.Method.ElectricityZone, Is.EqualTo("USA"));

        [Test]
        public void SaysTheZoneIsNotAnOverride()
            => Assert.That(_estimate.Method.ZoneIsOverride, Is.False);
    }

    [TestFixture]
    public class GivenASwedenOverride
    {
        private AICarbonEstimate _sweden = null!;
        private AICarbonEstimate _default = null!;

        [SetUp]
        public async Task SetUp()
        {
            _sweden = await EstimateAsync("SWE");
            _default = await EstimateAsync(null);
        }

        [Test]
        public void ReportsTheOverrideZone()
            => Assert.That(_sweden.Method.ElectricityZone, Is.EqualTo("SWE"));

        [Test]
        public void SaysTheZoneIsAnOverride()
            => Assert.That(_sweden.Method.ZoneIsOverride, Is.True);

        [Test]
        public void GivesALowerEstimateThanTheUsDefault()
            => Assert.That(_sweden.Total.Co2eGrams.Max, Is.LessThan(_default.Total.Co2eGrams.Max));
    }

    [TestFixture]
    public class GivenAnUnknownZone
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp() => _estimate = await EstimateAsync("XYZ");

        [Test]
        public void FallsBackToTheProviderDefault()
            => Assert.That(_estimate.Method.ElectricityZone, Is.EqualTo("USA"));
    }

    [TestFixture]
    public class GivenAMistralModelAndNoOverride
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(MistralUsage()).GetEstimateAsync(From, From.AddDays(7), null);

        [Test]
        public void ReportsTheProvidersDefaultZoneOnTheRow()
            => Assert.That(_estimate.ByModel.Single().ElectricityZone, Is.EqualTo("SWE"));
    }

    [TestFixture]
    public class GivenModelsWithDifferentProviderDefaultZones
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = AnthropicUsage().Add(new UsageRow("mistral", "codestral-latest", AICapability.Chat, From.AddDays(1), 1, 1000));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void HasNoSingleZone()
            => Assert.That(_estimate.Method.ElectricityZone, Is.Null);

        [Test]
        public void ListsEveryZoneUsedInOrder()
            => Assert.That(_estimate.Method.ElectricityZones, Is.EqualTo(new[] { "SWE", "USA" }));

        [Test]
        public void IsNotAnOverride()
            => Assert.That(_estimate.Method.ZoneIsOverride, Is.False);
    }

    [TestFixture]
    public class GivenALowerCaseOverride
    {
        private AICarbonEstimate _estimate = null!;
        private AICarbonEstimate _upperCase = null!;

        [SetUp]
        public async Task SetUp()
        {
            _estimate = await EstimateAsync("swe");
            _upperCase = await EstimateAsync("SWE");
        }

        [Test]
        public void ReportsTheCanonicalZoneCode()
            => Assert.That(_estimate.Method.ElectricityZone, Is.EqualTo("SWE"));

        [Test]
        public void GivesTheSameFigureAsTheUpperCaseCode()
            => Assert.That(_estimate.Total.Co2eGrams, Is.EqualTo(_upperCase.Total.Co2eGrams));
    }

    [TestFixture]
    public class GivenABlankOverride
    {
        private AICarbonEstimate _estimate = null!;
        private Mock<ILogger<ModelFactorResolver>> _logger = null!;

        [SetUp]
        public async Task SetUp()
        {
            _logger = new Mock<ILogger<ModelFactorResolver>>();
            _estimate = await EstimateOnAsync(EstimateServiceFactory.Create(AnthropicUsage(), electricityZone: "  ", factorLogger: _logger.Object));
        }

        [Test]
        public void LogsNoWarning()
            => Assert.That(_logger.Invocations, Is.Empty);

        [Test]
        public void CountsAsUnset()
            => Assert.That(_estimate.Method.ZoneIsOverride, Is.False);
    }

    [TestFixture]
    public class GivenAnOverrideAndAMixedSetOfProviders
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = AnthropicUsage().Add(new UsageRow("mistral", "codestral-latest", AICapability.Chat, From.AddDays(1), 1, 1000));
            _estimate = await EstimateServiceFactory.Create(usage, electricityZone: "DNK").GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void UsesTheOverrideForEveryModel()
            => Assert.That(_estimate.ByModel.Select(m => m.ElectricityZone), Is.All.EqualTo("DNK"));
    }

    [TestFixture]
    public class GivenAnOverrideAndNoUsage
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService(), electricityZone: "SWE")
                .GetEstimateAsync(From, From.AddDays(7), null);

        [Test]
        public void StillReportsTheOverrideZone()
            => Assert.That(_estimate.Method.ElectricityZone, Is.EqualTo("SWE"));

        [Test]
        public void ListsNoZonesUsed()
            => Assert.That(_estimate.Method.ElectricityZones, Is.Empty);
    }

    [TestFixture]
    public class GivenNoUsageAndNoOverride
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService()).GetEstimateAsync(From, From.AddDays(7), null);

        [Test]
        public void HasNoZone()
            => Assert.That(_estimate.Method.ElectricityZone, Is.Null);
    }

    [TestFixture]
    public class GivenAnUnknownZoneEstimatedTwice
    {
        private Mock<ILogger<ModelFactorResolver>> _logger = null!;

        [SetUp]
        public async Task SetUp()
        {
            _logger = new Mock<ILogger<ModelFactorResolver>>();
            var service = EstimateServiceFactory.Create(AnthropicUsage(), electricityZone: "XYZ", factorLogger: _logger.Object);
            await EstimateOnAsync(service);
            await EstimateOnAsync(service);
        }

        [Test]
        public void LogsOneWarning()
            => _logger.Verify(
                l => l.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.IsAny<It.IsAnyType>(),
                    It.IsAny<Exception?>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.Once);

        [Test]
        public void SaysNothingForFallbackFigures()
            => Assert.That(_logger.Invocations.Count, Is.EqualTo(1));
    }

    [TestFixture]
    public class GivenTheOverrideChangesBetweenEstimates
    {
        private AICarbonEstimate _before = null!;
        private AICarbonEstimate _after = null!;

        [SetUp]
        public async Task SetUp()
        {
            var options = new AICarbonOptions { ElectricityZone = null };
            var monitor = new Mock<IOptionsMonitor<AICarbonOptions>>();
            monitor.SetupGet(m => m.CurrentValue).Returns(() => options);
            var service = EstimateServiceFactory.Create(AnthropicUsage(), zoneOptions: monitor.Object);

            _before = await EstimateOnAsync(service);
            options.ElectricityZone = "SWE";
            _after = await EstimateOnAsync(service);
        }

        [Test]
        public void TheFigureFollowsTheNewZone()
            => Assert.That(_after.Total.Co2eGrams.Max, Is.LessThan(_before.Total.Co2eGrams.Max));

        [Test]
        public void TheNewZoneIsReported()
            => Assert.That(_after.Method.ElectricityZone, Is.EqualTo("SWE"));
    }

    [TestFixture]
    public class GivenAModelServedByAHostingProvider
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("amazon", "us.anthropic.claude-sonnet-4-5-20250929-v1:0", AICapability.Chat, From.AddDays(1), 1, 1000));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void UsesTheResolvedModelsProviderZone()
            => Assert.That(_estimate.ByModel.Single().ElectricityZone, Is.EqualTo("USA"));

        [Test]
        public async Task ScalesWithTheAnthropicDataCentreAssumptions()
        {
            var direct = await EstimateServiceFactory.Create(
                new FakeUsageAnalyticsService().Add(new UsageRow("anthropic", "claude-sonnet-4-5-20250929", AICapability.Chat, From.AddDays(1), 1, 1000)))
                .GetEstimateAsync(From, From.AddDays(7), null);
            Assert.That(_estimate.Total.Co2eGrams, Is.EqualTo(direct.Total.Co2eGrams));
        }
    }

    [TestFixture]
    public class GivenAnOverrideOnAnAnthropicModel
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp() => _estimate = await EstimateAsync("SWE");

        [Test]
        public void LowEndMatchesEcoLogits()
            => Assert.That(_estimate.Total.Co2eGrams.Min, Is.EqualTo(0.11215929516633093).Within(0.01).Percent);

        [Test]
        public void HighEndMatchesEcoLogits()
            => Assert.That(_estimate.Total.Co2eGrams.Max, Is.EqualTo(0.14667517225046693).Within(0.01).Percent);
    }

    [TestFixture]
    public class GivenAnOverrideOnAMistralModel
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateOnAsync(EstimateServiceFactory.Create(MistralUsage(), electricityZone: "DNK"));

        [Test]
        public void MatchesEcoLogits()
            => Assert.That(_estimate.Total.Co2eGrams.Max, Is.EqualTo(0.02063600108636326).Within(0.01).Percent);
    }

    [TestFixture]
    public class GivenTheOverrideChangesDuringOneEstimate
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var monitor = new Mock<IOptionsMonitor<AICarbonOptions>>();
            monitor.SetupSequence(m => m.CurrentValue)
                .Returns(new AICarbonOptions { ElectricityZone = "SWE" })
                .Returns(new AICarbonOptions { ElectricityZone = "DNK" })
                .Returns(new AICarbonOptions { ElectricityZone = "WOR" });
            var usage = AnthropicUsage().Add(new UsageRow("mistral", "codestral-latest", AICapability.Chat, From.AddDays(1), 1, 1000));
            _estimate = await EstimateOnAsync(EstimateServiceFactory.Create(usage, zoneOptions: monitor.Object));
        }

        [Test]
        public void EveryRowUsesTheZoneReadAtTheStart()
            => Assert.That(_estimate.ByModel.Select(m => m.ElectricityZone), Is.All.EqualTo("SWE"));
    }
}
