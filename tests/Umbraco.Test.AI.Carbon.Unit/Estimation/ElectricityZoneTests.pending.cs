// S6 (AC1–AC4) — Electricity zone selection. Task: T9.
using NUnit.Framework;
using Umbraco.AI.Core.Models;
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
}
