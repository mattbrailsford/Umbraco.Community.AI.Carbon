// S4 (AC2–AC4) — Estimate time series. Task: T7.
using NUnit.Framework;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Core.Models;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Tests.Unit.Support;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class EstimateTimeSeriesTests
{
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    [TestFixture]
    public class GivenUsageOnTwoOfSevenDays
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, From.AddDays(1).AddHours(3), 2, 800))
                .Add(new UsageRow("anthropic", "claude-sonnet-4-5", AICapability.Chat, From.AddDays(4).AddHours(9), 1, 1200));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), AIUsagePeriod.Daily);
        }

        [Test]
        public void HasOneBucketPerDay()
            => Assert.That(_estimate.TimeSeries, Has.Count.EqualTo(7));

        [Test]
        public void IncludesEmptyDaysAsZero()
            => Assert.That(_estimate.TimeSeries.Single(p => p.Timestamp == From.AddDays(2)).Co2eGrams.Max, Is.EqualTo(0));

        [Test]
        public void BucketMinsSumToTheTotalMin()
            => Assert.That(_estimate.TimeSeries.Sum(p => p.Co2eGrams.Min), Is.EqualTo(_estimate.Total.Co2eGrams.Min).Within(1e-9));

        [Test]
        public void BucketMaxesSumToTheTotalMax()
            => Assert.That(_estimate.TimeSeries.Sum(p => p.Co2eGrams.Max), Is.EqualTo(_estimate.Total.Co2eGrams.Max).Within(1e-9));
    }

    [TestFixture]
    public class GivenALast24HoursRequestWithNoGranularity
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService())
                .GetEstimateAsync(From, From.AddHours(24), null);

        [Test]
        public void UsesHourlyBuckets()
            => Assert.That(_estimate.Granularity, Is.EqualTo(AIUsagePeriod.Hourly));
    }

    [TestFixture]
    public class GivenALast30DaysRequestWithNoGranularity
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService())
                .GetEstimateAsync(From, From.AddDays(30), null);

        [Test]
        public void UsesDailyBuckets()
            => Assert.That(_estimate.Granularity, Is.EqualTo(AIUsagePeriod.Daily));
    }
}
