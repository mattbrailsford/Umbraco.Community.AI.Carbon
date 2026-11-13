// Task 7b — Daily estimates on the viewer's local days, so the CO2 tab counts what Umbraco.AI's Usage tab counts.
using NUnit.Framework;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Core.Models;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Tests.Unit.Support;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class EstimateLocalDayTests
{
    // Retention that keeps every day hourly, and one that leaves every earlier day to its daily row.
    private const int AllHourly = 100_000;
    private const int AllDaily = 0;

    // A fixed clock, so the retention line (15 October) does not move under the tests.
    private static readonly DateTime Now = new(2026, 11, 13, 15, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Today = Now.Date;
    private static readonly TimeProvider Clock = new FixedTimeProvider(Now);

    private static readonly TimeZoneInfo Copenhagen = TimeZoneInfo.FindSystemTimeZoneById("Europe/Copenhagen");
    private static readonly TimeZoneInfo NewYork = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

    private static DateTime Utc(int month, int day, int hour = 0, int minute = 0) => new(2026, month, day, hour, minute, 0, DateTimeKind.Utc);

    private static UsageRow Row(DateTime at, int requests = 1, string? featureType = null, bool DailyOnly = false)
        => new("openai", "gpt-4o-mini", AICapability.Chat, at, requests, 100 * requests, FeatureType: featureType, DailyOnly: DailyOnly);

    private static Task<AICarbonEstimate> EstimateAsync(
        FakeUsageAnalyticsService usage, DateTime from, DateTime to, TimeZoneInfo? zone, int retentionDays)
        => EstimateServiceFactory.Create(usage, hourlyRetentionDays: retentionDays, time: Clock).GetEstimateAsync(from, to, AIUsagePeriod.Daily, zone);

    // Hourly rows that exist before a range starts, so the data shows hourly rows reach back past it, as they do for a
    // range inside retention. It is outside the range, so it is never counted.
    private static UsageRow HourlyBefore(DateTime from) => Row(from.Date.AddDays(-1).AddHours(12));

    private static long Requests(AICarbonEstimate estimate) => estimate.Total.Requests;

    private static IEnumerable<DateTime> Timestamps(AICarbonEstimate estimate) => estimate.TimeSeries.Select(point => point.Timestamp);

    private static DateTime[] ActiveTimestamps(AICarbonEstimate estimate)
        => estimate.TimeSeries.Where(point => point.Co2eGrams.Max > 0).Select(point => point.Timestamp).ToArray();

    // Copenhagen is UTC+2 on these days, so local 5 to 7 October is 4 October 22:00Z up to 7 October 22:00Z.
    [TestFixture]
    public class GivenAnEasternZoneWithinHourlyRetention
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(HourlyBefore(Utc(10, 4, 22)))
                .Add(Row(Utc(10, 4, 21, 30))) // 23:30 on the 4th locally: before the range
                .Add(Row(Utc(10, 4, 22, 30))) // 00:30 on the 5th: in, and what a UTC-day read drops
                .Add(Row(Utc(10, 7, 21, 30))) // 23:30 on the 7th: in
                .Add(Row(Utc(10, 7, 22, 30))); // 00:30 on the 8th: after the range
            _estimate = await EstimateAsync(usage, Utc(10, 4, 22), Utc(10, 7, 22), Copenhagen, AllHourly);
        }

        [Test]
        public void CountsTheRequestsOnTheLocalDays() => Assert.That(Requests(_estimate), Is.EqualTo(2));

        [Test]
        public void HasOnePointPerLocalDayAtItsStart()
            => Assert.That(Timestamps(_estimate), Is.EqualTo(new[] { Utc(10, 4, 22), Utc(10, 5, 22), Utc(10, 6, 22) }));

        [Test]
        public void PutsTheEdgeRequestsOnTheFirstAndLastDay()
            => Assert.That(ActiveTimestamps(_estimate), Is.EqualTo(new[] { Utc(10, 4, 22), Utc(10, 6, 22) }));
    }

    // New York is UTC-4 on these days, so local 5 to 7 October is 5 October 04:00Z up to 8 October 04:00Z.
    [TestFixture]
    public class GivenAWesternZoneWithinHourlyRetention
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(HourlyBefore(Utc(10, 5, 4)))
                .Add(Row(Utc(10, 5, 3, 30))) // 23:30 on the 4th locally: before the range
                .Add(Row(Utc(10, 5, 4, 30))) // 00:30 on the 5th: in
                .Add(Row(Utc(10, 8, 3, 30))) // 23:30 on the 7th: in
                .Add(Row(Utc(10, 8, 4, 30))); // 00:30 on the 8th: after the range
            _estimate = await EstimateAsync(usage, Utc(10, 5, 4), Utc(10, 8, 4), NewYork, AllHourly);
        }

        [Test]
        public void CountsTheRequestsOnTheLocalDays() => Assert.That(Requests(_estimate), Is.EqualTo(2));

        [Test]
        public void HasOnePointPerLocalDayAtItsStart()
            => Assert.That(Timestamps(_estimate), Is.EqualTo(new[] { Utc(10, 5, 4), Utc(10, 6, 4), Utc(10, 7, 4) }));
    }

    // Beyond retention only UTC days exist, and each goes to the local day its midday falls on, as in the Usage tab.
    [TestFixture]
    public class GivenAWesternZoneBeyondHourlyRetention
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(Utc(10, 4, 10))) // the UTC day of the 4th: its midday is 08:00 on the 4th in New York
                .Add(Row(Utc(10, 5, 10), 2)) // the 5th: the first local day, which a read from 04:00Z on the 5th drops
                .Add(Row(Utc(10, 7, 10), 3)) // the 7th: the last local day
                .Add(Row(Utc(10, 8, 10))); // the 8th
            _estimate = await EstimateAsync(usage, Utc(10, 5, 4), Utc(10, 8, 4), NewYork, AllDaily);
        }

        [Test]
        public void CountsTheDaysWhoseMiddayIsInTheRange() => Assert.That(Requests(_estimate), Is.EqualTo(5));

        [Test]
        public void StampsEachDayWithItsLocalStart()
            => Assert.That(ActiveTimestamps(_estimate), Is.EqualTo(new[] { Utc(10, 5, 4), Utc(10, 7, 4) }));
    }

    [TestFixture]
    public class GivenAnEasternZoneBeyondHourlyRetention
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(Utc(10, 4, 10))) // midday 12:00Z on the 4th is 14:00 locally on the 4th: before the range
                .Add(Row(Utc(10, 5, 10), 2)) // the 5th
                .Add(Row(Utc(10, 7, 10), 3)) // the 7th
                .Add(Row(Utc(10, 8, 10))); // the 8th: midday after the range
            _estimate = await EstimateAsync(usage, Utc(10, 4, 22), Utc(10, 7, 22), Copenhagen, AllDaily);
        }

        [Test]
        public void CountsTheDaysWhoseMiddayIsInTheRange() => Assert.That(Requests(_estimate), Is.EqualTo(5));

        [Test]
        public void StampsEachDayWithItsLocalStart()
            => Assert.That(ActiveTimestamps(_estimate), Is.EqualTo(new[] { Utc(10, 4, 22), Utc(10, 6, 22) }));
    }

    // Copenhagen ends summer time at 01:00Z on 25 October, so that local day is 25 hours long.
    [TestFixture]
    public class GivenARangeAcrossAClockChange
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(HourlyBefore(Utc(10, 23, 22)))
                .Add(Row(Utc(10, 24, 22, 30))) // 00:30 on the 25th (summer time)
                .Add(Row(Utc(10, 25, 22, 30))) // 23:30 on the 25th (winter time): still the 25th
                .Add(Row(Utc(10, 25, 23, 30))); // 00:30 on the 26th
            _estimate = await EstimateAsync(usage, Utc(10, 23, 22), Utc(10, 26, 23), Copenhagen, AllHourly);
        }

        [Test]
        public void StartsEachLocalDayAtItsMidnight()
            => Assert.That(Timestamps(_estimate), Is.EqualTo(new[] { Utc(10, 23, 22), Utc(10, 24, 22), Utc(10, 25, 23) }));

        [Test]
        public void KeepsTheLongDaysLastHourOnThatDay()
            => Assert.That(ActiveTimestamps(_estimate), Is.EqualTo(new[] { Utc(10, 24, 22), Utc(10, 25, 23) }));

        [Test]
        public void CountsEveryRequest() => Assert.That(Requests(_estimate), Is.EqualTo(3));
    }

    // The retention line is a moving UTC midnight: the first midnight at or after now minus 30 days, so 29 days
    // back from today's midnight. The hourly rows of the day before it are the partly cleaned-up first day.
    [TestFixture]
    public class GivenARangeStraddlingHourlyRetention
    {
        private static readonly DateTime Line = Today.AddDays(-29);

        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(Line.AddDays(-2).AddHours(10), DailyOnly: true)) // a daily row, well before the line
                .Add(Row(Line.AddDays(-1).AddHours(3), DailyOnly: true)) // the first hourly day, part cleaned
                .Add(Row(Line.AddHours(-1))) // the last hour before the line: part of the UTC day before it, so its daily row
                .Add(Row(Line)) // the first hour after it: an hourly row
                .Add(Row(Line.AddHours(1)))
                .Add(Row(Line.AddDays(2).AddHours(10)));
            var from = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Line.AddDays(-3)), Copenhagen);
            var to = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Line.AddDays(4)), Copenhagen);
            _estimate = await EstimateServiceFactory.Create(usage, time: Clock).GetEstimateAsync(from, to, AIUsagePeriod.Daily, Copenhagen);
        }

        [Test]
        public void CountsEachRequestOnce() => Assert.That(Requests(_estimate), Is.EqualTo(6));

        [Test]
        public void HasOnePointPerLocalDay() => Assert.That(_estimate.TimeSeries, Has.Count.EqualTo(7));

        [Test]
        public void ReportsEveryRequestOnItsLocalDay()
            => Assert.That(_estimate.TimeSeries.Count(point => point.Co2eGrams.Max > 0), Is.EqualTo(4));

        [Test]
        public void PutsTheHourBeforeTheLineOnTheDayItsUtcDayBelongsTo()
            => Assert.That(
                _estimate.TimeSeries.Single(point => point.Timestamp == AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Line.AddDays(-1)), Copenhagen)).Co2eGrams.Max,
                Is.GreaterThan(0));
    }

    // The cleanup job deletes hourly rows once a day, so after a run on the previous UTC day the first hourly day is
    // two days before the clock's line. Local 00:30 to 01:30 hours of the first day show which side reads it.
    [TestFixture]
    public class GivenTheCleanupJobLastRanYesterday
    {
        private static readonly DateTime Line = Today.AddDays(-29);

        [Test]
        public async Task ReadsTheDayBeforeTheClockLineFromItsHourlyRows()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(Line.AddDays(-2).AddHours(3), DailyOnly: true)) // the first hourly day is Line - 2 (part cleaned), so the line is Line - 1
                .Add(Row(Line.AddDays(-2).AddHours(10)))
                .Add(Row(Line.AddDays(-1).AddHours(23).AddMinutes(30))); // 00:30 or 01:30 locally on Line: by hour it is on Line
            var from = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Line.AddDays(-2)), Copenhagen);
            var to = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Line.AddDays(2)), Copenhagen);

            var estimate = await EstimateServiceFactory.Create(usage, time: Clock).GetEstimateAsync(from, to, AIUsagePeriod.Daily, Copenhagen);

            Assert.That(
                estimate.TimeSeries.Single(point => point.Timestamp == AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Line), Copenhagen)).Co2eGrams.Max,
                Is.GreaterThan(0));
        }

        [Test]
        public async Task KeepsTheClockLineWhenTheDayBeforeItIsTheFirstHourlyDay()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(Line.AddDays(-1).AddHours(3), DailyOnly: true)) // the first hourly day is Line - 1 (part cleaned)
                .Add(Row(Line.AddDays(-1).AddHours(23).AddMinutes(30))); // by day (midday rule) it is on Line - 1 locally
            var from = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Line.AddDays(-2)), Copenhagen);
            var to = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Line.AddDays(2)), Copenhagen);

            var estimate = await EstimateServiceFactory.Create(usage, time: Clock).GetEstimateAsync(from, to, AIUsagePeriod.Daily, Copenhagen);

            Assert.That(
                ActiveTimestamps(estimate),
                Is.EqualTo(new[] { AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Line.AddDays(-1)), Copenhagen) }));
        }
    }

    // After the retention is raised the rows older than the old setting are gone, so the first hourly day is later
    // than the clock's line and the days before it only exist as daily rows.
    [TestFixture]
    public class GivenTheRetentionWasRaised
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var firstHourly = Today.AddDays(-29);
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(firstHourly.AddDays(-20).AddHours(10), 2, DailyOnly: true))
                .Add(Row(firstHourly.AddDays(-1).AddHours(10), 3, DailyOnly: true))
                .Add(Row(firstHourly.AddHours(10), 4))
                .Add(Row(firstHourly.AddDays(3).AddHours(10), 5));
            var from = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(firstHourly.AddDays(-30)), Copenhagen);
            var to = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(firstHourly.AddDays(5)), Copenhagen);
            _estimate = await EstimateServiceFactory.Create(usage, hourlyRetentionDays: 60, time: Clock).GetEstimateAsync(from, to, AIUsagePeriod.Daily, Copenhagen);
        }

        [Test]
        public void CountsTheDaysWhoseHourlyRowsAreGone() => Assert.That(Requests(_estimate), Is.EqualTo(14));
    }

    [TestFixture]
    public class GivenNoUsageAtAll
    {
        [Test]
        public async Task ReturnsAnEmptyEstimateOnRangesAroundTheLine()
        {
            var line = Today.AddDays(-29);
            var from = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(line.AddDays(-3)), Copenhagen);
            var to = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(line.AddDays(4)), Copenhagen);

            var estimate = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService(), time: Clock).GetEstimateAsync(from, to, AIUsagePeriod.Daily, Copenhagen);

            Assert.That((Requests(estimate), estimate.TimeSeries.Count), Is.EqualTo((0L, 7)));
        }
    }

    [TestFixture]
    public class GivenARangeFarFromTheLine
    {
        [Test]
        public async Task InsideRetentionTakesTwoChecks()
        {
            var usage = new FakeUsageAnalyticsService().Add(Row(Today.AddDays(-8).AddHours(12)));
            var to = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Today.AddDays(1)), Copenhagen);

            await EstimateServiceFactory.Create(usage, time: Clock).GetEstimateAsync(to.AddDays(-7), to, AIUsagePeriod.Daily, Copenhagen);

            // Two checks (the hourly and the daily series), then the two breakdown reads of the hourly part.
            Assert.That(usage.ReceivedTokens, Has.Count.EqualTo(2 + 2));
        }

        [Test]
        public async Task ARangeStartingInTheFutureMakesNoExtraCalls()
        {
            var usage = new FakeUsageAnalyticsService();

            await EstimateServiceFactory.Create(usage, time: Clock).GetEstimateAsync(Today.AddDays(2), Today.AddDays(9), AIUsagePeriod.Daily, Copenhagen);

            Assert.That(usage.ReceivedTokens, Has.Count.EqualTo(2));
        }

        [Test]
        public async Task BeyondRetentionMakesNoExtraCalls()
        {
            var usage = new FakeUsageAnalyticsService();
            var to = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Today.AddDays(-90)), Copenhagen);

            await EstimateServiceFactory.Create(usage, time: Clock).GetEstimateAsync(to.AddDays(-7), to, AIUsagePeriod.Daily, Copenhagen);

            Assert.That(usage.ReceivedTokens, Has.Count.EqualTo(2));
        }

        [Test]
        public async Task NearTheLineTakesTwoChecks()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(Today.AddDays(-30).AddHours(3), DailyOnly: true)) // the first hourly day is part cleaned
                .Add(Row(Today.AddDays(-30).AddHours(10)));
            var line = Today.AddDays(-29);

            await EstimateServiceFactory.Create(usage, time: Clock).GetEstimateAsync(line.AddDays(-3), line.AddDays(4), AIUsagePeriod.Daily, Copenhagen);

            // 2 checks (the hourly and the daily series); 4 breakdown reads, 4 for the
            // one provider and model, and 8 for the feature split (4 types), each over the daily and the hourly part.
            Assert.That(usage.ReceivedTokens, Has.Count.EqualTo(2 + 4 + 4 + 8));
        }
    }

    // A quiet site: nothing was used the day before the range, so there is no hourly row near its start to show
    // that hourly rows reach back. The request in the first local hour must still be read by hour, and counted once.
    [TestFixture]
    public class GivenAQuietDayBeforeARangeEastOfUtc
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            // Local 11 to 13 November in Copenhagen (UTC+1) is 10 November 23:00Z up to 13 November 23:00Z.
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(Utc(11, 10, 22, 30))) // 23:30 on the 10th locally: before the range
                .Add(Row(Utc(11, 10, 23, 30))) // 00:30 on the 11th: in
                .Add(Row(Utc(11, 12, 10)));
            _estimate = await EstimateServiceFactory.Create(usage, time: Clock)
                .GetEstimateAsync(Utc(11, 10, 23), Utc(11, 13, 23), AIUsagePeriod.Daily, Copenhagen);
        }

        [Test]
        public void CountsTheEdgeRequestOnce() => Assert.That(Requests(_estimate), Is.EqualTo(2));

        [Test]
        public void PutsTheEdgeRequestOnTheFirstLocalDay()
            => Assert.That(ActiveTimestamps(_estimate), Is.EqualTo(new[] { Utc(11, 10, 23), Utc(11, 11, 23) }));
    }

    [TestFixture]
    public class GivenAQuietDayBeforeARangeWestOfUtc
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            // Local 11 to 13 November in New York (UTC-5) is 11 November 05:00Z up to 14 November 05:00Z.
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(Utc(11, 11, 4, 30))) // 23:30 on the 10th locally: before the range
                .Add(Row(Utc(11, 11, 5, 30))) // 00:30 on the 11th: in
                .Add(Row(Utc(11, 12, 10)));
            _estimate = await EstimateServiceFactory.Create(usage, time: Clock)
                .GetEstimateAsync(Utc(11, 11, 5), Utc(11, 14, 5), AIUsagePeriod.Daily, NewYork);
        }

        [Test]
        public void CountsOnlyTheRequestsInTheRange() => Assert.That(Requests(_estimate), Is.EqualTo(2));

        [Test]
        public void PutsTheEdgeRequestOnTheFirstLocalDay()
            => Assert.That(ActiveTimestamps(_estimate), Is.EqualTo(new[] { Utc(11, 11, 5), Utc(11, 12, 5) }));
    }

    // Raised retention with quiet days among the cleaned ones: a quiet day is neither proof for nor against cleanup.
    [TestFixture]
    public class GivenQuietDaysAmongCleanedDaysAfterARetentionRaise
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(Row(Utc(9, 20, 10), 2, DailyOnly: true))
                .Add(Row(Utc(10, 10, 10), 3, DailyOnly: true)) // 21 September to 9 October are quiet
                .Add(Row(Utc(10, 15, 10), 4))
                .Add(Row(Utc(10, 16, 10), 5));
            var from = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Utc(9, 15)), Copenhagen);
            var to = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Utc(11, 14)), Copenhagen);
            _estimate = await EstimateServiceFactory.Create(usage, hourlyRetentionDays: 60, time: Clock)
                .GetEstimateAsync(from, to, AIUsagePeriod.Daily, Copenhagen);
        }

        [Test]
        public void CountsEveryRequestOnce() => Assert.That(Requests(_estimate), Is.EqualTo(14));
    }

    [TestFixture]
    public class GivenARangeIncludingToday
    {
        private AICarbonEstimate _estimate = null!;
        private DateTime _recent;

        [SetUp]
        public async Task SetUp()
        {
            _recent = Now.AddMinutes(-10);
            var usage = new FakeUsageAnalyticsService().Add(Row(_recent));
            var today = AICarbonLocalDays.LocalDate(Now, NewYork);
            var from = AICarbonLocalDays.LocalDayStartUtc(today.AddDays(-2), NewYork);
            var to = AICarbonLocalDays.LocalDayStartUtc(today.AddDays(1), NewYork);
            _estimate = await EstimateServiceFactory.Create(usage, time: Clock).GetEstimateAsync(from, to, AIUsagePeriod.Daily, NewYork);
        }

        [Test]
        public void CountsTheRecentRequest() => Assert.That(Requests(_estimate), Is.EqualTo(1));

        [Test]
        public void PutsItOnTodaysLocalDay()
            => Assert.That(
                ActiveTimestamps(_estimate),
                Is.EqualTo(new[] { AICarbonLocalDays.LocalDayStartUtc(AICarbonLocalDays.LocalDate(_recent, NewYork), NewYork) }));

        [Test]
        public void HasThreePoints() => Assert.That(_estimate.TimeSeries, Has.Count.EqualTo(3));
    }

    [TestFixture]
    public class GivenNoZone
    {
        [Test]
        public async Task KeepsUtcDays()
        {
            var usage = new FakeUsageAnalyticsService().Add(Row(Utc(10, 5, 10)));

            var estimate = await EstimateAsync(usage, Utc(10, 4), Utc(10, 7), zone: null, AllHourly);

            Assert.That(ActiveTimestamps(estimate), Is.EqualTo(new[] { Utc(10, 5) }));
        }
    }

    [TestFixture]
    public class GivenHourlyBucketsAndAZone
    {
        [Test]
        public async Task StaysOnUtcHours()
        {
            var usage = new FakeUsageAnalyticsService().Add(Row(Utc(10, 5, 10, 30)));

            var estimate = await EstimateServiceFactory.Create(usage, time: Clock)
                .GetEstimateAsync(Utc(10, 5), Utc(10, 6), AIUsagePeriod.Hourly, NewYork);

            Assert.That(ActiveTimestamps(estimate), Is.EqualTo(new[] { Utc(10, 5, 10) }));
        }
    }

    [TestFixture]
    public class GivenAFeatureSplitInAZone
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(HourlyBefore(Utc(10, 4, 22)))
                .Add(Row(Utc(10, 4, 21, 30), 5, "agent")) // before the first local day
                .Add(Row(Utc(10, 4, 22, 30), 2, "agent"))
                .Add(Row(Utc(10, 6, 12), 3, "prompt"));
            _estimate = await EstimateAsync(usage, Utc(10, 4, 22), Utc(10, 7, 22), Copenhagen, AllHourly);
        }

        [Test]
        public void CountsTheTotalOnTheLocalDays() => Assert.That(Requests(_estimate), Is.EqualTo(5));

        [Test]
        public void SplitsTheSameRequests()
            => Assert.That(_estimate.ByFeature.Items.Sum(item => item.Requests), Is.EqualTo(5));

        [Test]
        public void CountsAgentRequestsOnTheLocalDays()
            => Assert.That(_estimate.ByFeature.Items.Single(item => item.FeatureType == "agent").Requests, Is.EqualTo(2));
    }

    [TestFixture]
    public class GivenTheLocalDayStart
    {
        [Test]
        public void MovesAMidnightThatDoesNotExistToTheFirstTimeThatDoes()
        {
            // Beirut skips 00:00 to 01:00 on 29 March 2026, so that day starts when the clocks jump (22:00Z the day before).
            var beirut = TimeZoneInfo.FindSystemTimeZoneById("Asia/Beirut");

            Assert.That(AICarbonLocalDays.LocalDayStartUtc(new DateOnly(2026, 3, 29), beirut), Is.EqualTo(Utc(3, 28, 22)));
        }

        [Test]
        public void UsesTheFirstOfARepeatedMidnight()
        {
            // Havana repeats 00:00 to 01:00 on 1 November 2026: the first is summer time (UTC-4).
            var havana = TimeZoneInfo.FindSystemTimeZoneById("America/Havana");

            Assert.That(AICarbonLocalDays.LocalDayStartUtc(new DateOnly(2026, 11, 1), havana), Is.EqualTo(Utc(11, 1, 4)));
        }

        [Test]
        public void StartsACopenhagenDayAtItsMidnight()
            => Assert.That(AICarbonLocalDays.LocalDayStartUtc(new DateOnly(2026, 1, 15), Copenhagen), Is.EqualTo(Utc(1, 14, 23)));
    }

    // The plan itself, with the hourly line on 15 October.
    [TestFixture]
    public class GivenThePlanForADailyRange
    {
        private static readonly DateTime Line = Utc(10, 15);

        private static IReadOnlyList<AICarbonLocalDays.Segment> Plan(DateTime from, DateTime to, TimeZoneInfo? zone = null, AIUsagePeriod bucket = AIUsagePeriod.Daily)
            => AICarbonLocalDays.Plan(from, to, bucket, zone ?? Copenhagen, Line);

        [Test]
        public void ReadsARangeInsideRetentionAsHoursWithTheExactWindow()
            => Assert.That(
                Plan(Utc(11, 1, 23), Utc(11, 9, 23)),
                Is.EqualTo(new[] { new AICarbonLocalDays.Segment(Utc(11, 1, 23), Utc(11, 9, 23), AIUsagePeriod.Hourly, false) }));

        [Test]
        public void ReadsARangeBeyondRetentionAsDaysTwelveHoursEarlier()
            => Assert.That(
                Plan(Utc(10, 1, 22), Utc(10, 8, 22)),
                Is.EqualTo(new[] { new AICarbonLocalDays.Segment(Utc(10, 1, 10), Utc(10, 8, 10), AIUsagePeriod.Daily, true) }));

        [Test]
        public void SplitsARangeAtTheRetentionLine()
            => Assert.That(
                Plan(Utc(10, 10, 22), Utc(10, 20, 22)),
                Is.EqualTo(new[]
                {
                    new AICarbonLocalDays.Segment(Utc(10, 10, 10), Line, AIUsagePeriod.Daily, true),
                    new AICarbonLocalDays.Segment(Line, Utc(10, 20, 22), AIUsagePeriod.Hourly, false),
                }));

        [Test]
        public void LeavesOutTheDailyReadWhenNoUtcMidnightIsInIt()
            => Assert.That(
                Plan(Utc(10, 14, 22), Utc(11, 13, 23)),
                Is.EqualTo(new[] { new AICarbonLocalDays.Segment(Line, Utc(11, 13, 23), AIUsagePeriod.Hourly, false) }));

        [Test]
        public void RoundsTheHourlyEdgesUpToWholeHoursInAHalfHourZone()
        {
            var kolkata = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");

            Assert.That(
                Plan(Utc(11, 1, 18, 30), Utc(11, 5, 18, 30), kolkata),
                Is.EqualTo(new[] { new AICarbonLocalDays.Segment(Utc(11, 1, 19), Utc(11, 5, 19), AIUsagePeriod.Hourly, false) }));
        }

        [Test]
        public void PutsTheClockLineOnTheFirstMidnightAfterTheRetentionPeriod()
            => Assert.That(AICarbonLocalDays.ClockLine(30, Utc(11, 13, 15)), Is.EqualTo(Line));

        [Test]
        public void ReadsOnceAsAskedWithoutAZone()
            => Assert.That(
                AICarbonLocalDays.Plan(Utc(10, 1), Utc(10, 8), AIUsagePeriod.Daily, null, Line),
                Is.EqualTo(new[] { new AICarbonLocalDays.Segment(Utc(10, 1), Utc(10, 8), AIUsagePeriod.Daily, false) }));

        [Test]
        public void ReadsOnceAsAskedForHourlyBuckets()
            => Assert.That(
                Plan(Utc(10, 1, 22), Utc(10, 2, 22), bucket: AIUsagePeriod.Hourly),
                Is.EqualTo(new[] { new AICarbonLocalDays.Segment(Utc(10, 1, 22), Utc(10, 2, 22), AIUsagePeriod.Hourly, false) }));
    }
}
