// S4 (AC2–AC4) — Estimate time series. Task: T7.
using Moq;
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

    [TestFixture]
    public class GivenAWindowThatStartsMidHour
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, From.AddHours(11).AddMinutes(5), 1, 100));
            _estimate = await EstimateServiceFactory.Create(usage)
                .GetEstimateAsync(From.AddHours(10).AddMinutes(37), From.AddHours(14), AIUsagePeriod.Hourly);
        }

        [Test]
        public void StartsAtTheNextWholeHour()
            => Assert.That(_estimate.TimeSeries[0].Timestamp, Is.EqualTo(From.AddHours(11)));

        [Test]
        public void HasOneBucketForEachWholeHourBeforeTheEnd()
            => Assert.That(_estimate.TimeSeries, Has.Count.EqualTo(3));

        [Test]
        public void KeepsTheUsageInTheFirstBucket()
            => Assert.That(_estimate.TimeSeries[0].Co2eGrams.Max, Is.GreaterThan(0));
    }

    [TestFixture]
    public class GivenAnHourlyWindowAcrossMidnight
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, From.AddHours(23).AddMinutes(30), 1, 100))
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, From.AddHours(24).AddMinutes(10), 1, 100));
            _estimate = await EstimateServiceFactory.Create(usage)
                .GetEstimateAsync(From.AddHours(22), From.AddHours(26), AIUsagePeriod.Hourly);
        }

        [Test]
        public void ListsTheBucketsInOrderAcrossTheDayBoundary()
            => Assert.That(
                _estimate.TimeSeries.Select(p => p.Timestamp),
                Is.EqualTo(new[] { From.AddHours(22), From.AddHours(23), From.AddHours(24), From.AddHours(25) }));

        [Test]
        public void PutsUsageAfterMidnightInTheNextDaysBucket()
            => Assert.That(_estimate.TimeSeries.Single(p => p.Timestamp == From.AddHours(24)).Co2eGrams.Max, Is.GreaterThan(0));
    }

    [TestFixture]
    public class GivenOnlyFailedRequestsInABucket
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, From.AddHours(2), 3, 0, FailedRequests: 3));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddHours(4), AIUsagePeriod.Hourly);
        }

        [Test]
        public void AddsNoPerRequestEmissions()
            => Assert.That(_estimate.TimeSeries.Sum(p => p.Co2eGrams.Max), Is.EqualTo(0));
    }

    [TestFixture]
    public class GivenTwoModelsInTheSameBucket
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, From.AddHours(1), 2, 800))
                .Add(new UsageRow("anthropic", "claude-sonnet-4-5", AICapability.Chat, From.AddHours(1).AddMinutes(20), 1, 1200));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddHours(3), AIUsagePeriod.Hourly);
        }

        [Test]
        public void TheBucketHoldsBothModelsTogether()
            => Assert.That(
                _estimate.TimeSeries.Single(p => p.Timestamp == From.AddHours(1)).Co2eGrams.Max,
                Is.EqualTo(_estimate.ByModel.Sum(row => row.Co2eGrams!.Value.Max)).Within(1e-9));
    }

    [TestFixture]
    public class GivenAModelWithOnlyNonChatUsage
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "text-embedding-3-small", AICapability.Embedding, From.AddHours(1), 4, 0));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddHours(3), AIUsagePeriod.Hourly);
        }

        [Test]
        public void AddsNothingToTheSeries()
            => Assert.That(_estimate.TimeSeries.Sum(p => p.Co2eGrams.Max), Is.EqualTo(0));
    }

    [TestFixture]
    public class GivenNoUsageAtAll
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService())
                .GetEstimateAsync(From, From.AddHours(5), AIUsagePeriod.Hourly);

        [Test]
        public void HasOneBucketPerHour()
            => Assert.That(_estimate.TimeSeries, Has.Count.EqualTo(5));

        [Test]
        public void EveryBucketIsZero()
            => Assert.That(_estimate.TimeSeries.Sum(p => p.Co2eGrams.Max), Is.EqualTo(0));
    }

    [TestFixture]
    public class GivenAWindowLongerThanTheLimit
    {
        [TestCase(AIUsagePeriod.Hourly, AICarbonEstimateLimits.MaxHourlyWindowDays)]
        [TestCase(AIUsagePeriod.Daily, AICarbonEstimateLimits.MaxDailyWindowDays)]
        public void ThrowsOneHourOver(AIUsagePeriod granularity, int maxDays)
            => Assert.ThrowsAsync<ArgumentException>(() => EstimateServiceFactory.Create(new FakeUsageAnalyticsService())
                .GetEstimateAsync(From, From.AddDays(maxDays).AddHours(1), granularity));

        [TestCase(AIUsagePeriod.Hourly, AICarbonEstimateLimits.MaxHourlyWindowDays)]
        [TestCase(AIUsagePeriod.Daily, AICarbonEstimateLimits.MaxDailyWindowDays)]
        public void AcceptsExactlyTheLimit(AIUsagePeriod granularity, int maxDays)
            => Assert.DoesNotThrowAsync(() => EstimateServiceFactory.Create(new FakeUsageAnalyticsService())
                .GetEstimateAsync(From, From.AddDays(maxDays), granularity));

        [Test]
        public void CountsAnAutoPickedDailyWindowAsDaily()
            => Assert.DoesNotThrowAsync(() => EstimateServiceFactory.Create(new FakeUsageAnalyticsService())
                .GetEstimateAsync(From, From.AddDays(AICarbonEstimateLimits.MaxHourlyWindowDays + 30), null));
    }

    [TestFixture]
    public class GivenLocalAndUnspecifiedTimes
    {
        private AICarbonEstimate _local = null!;
        private AICarbonEstimate _unspecified = null!;

        [SetUp]
        public async Task SetUp()
        {
            var service = EstimateServiceFactory.Create(new FakeUsageAnalyticsService());
            var local = new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Local);
            _local = await service.GetEstimateAsync(local, local.AddHours(2), AIUsagePeriod.Hourly);
            _unspecified = await service.GetEstimateAsync(
                new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Unspecified),
                new DateTime(2026, 10, 1, 14, 0, 0, DateTimeKind.Unspecified),
                AIUsagePeriod.Hourly);
        }

        [Test]
        public void ALocalStartIsConvertedToUtc()
            => Assert.That(_local.From, Is.EqualTo(new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Local).ToUniversalTime()));

        [Test]
        public void ALocalStartIsReportedAsUtc()
            => Assert.That(_local.From.Kind, Is.EqualTo(DateTimeKind.Utc));

        [Test]
        public void AnUnspecifiedStartKeepsItsClockTime()
            => Assert.That(_unspecified.From, Is.EqualTo(new DateTime(2026, 10, 1, 12, 0, 0)));

        [Test]
        public void AnUnspecifiedEndIsReportedAsUtc()
            => Assert.That(_unspecified.To.Kind, Is.EqualTo(DateTimeKind.Utc));
    }

    [TestFixture]
    public class GivenAnalyticsIsDisabled
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService(), analyticsEnabled: false)
                .GetEstimateAsync(From, From.AddHours(6), AIUsagePeriod.Hourly);

        [Test]
        public void HasOneBucketPerHour()
            => Assert.That(_estimate.TimeSeries, Has.Count.EqualTo(6));

        [Test]
        public void EveryBucketIsZero()
            => Assert.That(_estimate.TimeSeries.Sum(p => p.Co2eGrams.Max), Is.EqualTo(0));
    }

    // Umbraco.AI reads the current period live and stamps it with the current bucket start, which can be
    // before the window's `from`. The fake cannot do that, so this stubs the service.
    [TestFixture]
    public class GivenALiveBucketStampedBeforeTheWindowStart
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var live = From.AddHours(10);
            var usage = new Mock<IAIUsageAnalyticsService>();
            usage.Setup(u => u.GetBreakdownByProviderAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<AIUsagePeriod?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new[] { new AIUsageBreakdownItem { Dimension = "openai", RequestCount = 1, TotalTokens = 500, Percentage = 100 } });
            usage.Setup(u => u.GetBreakdownByModelAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<AIUsagePeriod?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new[] { new AIUsageBreakdownItem { Dimension = "gpt-4o-mini", RequestCount = 1, TotalTokens = 500, Percentage = 100 } });
            usage.Setup(u => u.GetSummaryAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<AIUsagePeriod?>(), It.IsAny<AIUsageFilter?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new AIUsageSummary { TotalRequests = 1, SuccessCount = 1, FailureCount = 0, SuccessRate = 1, InputTokens = 0, OutputTokens = 500, TotalTokens = 500, AverageDurationMs = 0 });
            usage.Setup(u => u.GetTimeSeriesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<AIUsagePeriod?>(), It.IsAny<AIUsageFilter?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new[] { new AIUsageTimeSeriesPoint { Timestamp = live, RequestCount = 1, SuccessCount = 1, FailureCount = 0, InputTokens = 0, OutputTokens = 500, TotalTokens = 500 } });
            _estimate = await EstimateServiceFactory.Create(usage.Object)
                .GetEstimateAsync(live.AddMinutes(37), From.AddHours(14), AIUsagePeriod.Hourly);
        }

        [Test]
        public void KeepsTheLiveBucket()
            => Assert.That(_estimate.TimeSeries.Single(p => p.Timestamp == From.AddHours(10)).Co2eGrams.Max, Is.GreaterThan(0));

        [Test]
        public void StillSumsToTheTotal()
            => Assert.That(_estimate.TimeSeries.Sum(p => p.Co2eGrams.Max), Is.EqualTo(_estimate.Total.Co2eGrams.Max).Within(1e-9));

        [Test]
        public void KeepsTheSeriesInOrder()
            => Assert.That(_estimate.TimeSeries.Select(p => p.Timestamp), Is.Ordered);
    }
}
