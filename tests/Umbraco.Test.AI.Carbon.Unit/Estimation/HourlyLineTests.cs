// Task 7b — where Daily estimates in a zone switch from daily rows to hourly rows: the day after the last UTC day whose
// daily total is more than its hourly total (hourly rows cleaned up), found from the data with two series reads. A day
// with no usage proves nothing. The clock is fixed at 13 November 2026 15:00Z, so with 30 days of hourly retention the
// clock's guess is 15 October.
using Microsoft.Extensions.Options;
using Moq;
using NUnit.Framework;
using Umbraco.AI.Core.Analytics;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Core.Models;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Tests.Unit.Support;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class HourlyLineTests
{
    private static readonly DateTime Now = new(2026, 11, 13, 15, 0, 0, DateTimeKind.Utc);
    private static readonly TimeZoneInfo Copenhagen = TimeZoneInfo.FindSystemTimeZoneById("Europe/Copenhagen");

    private static DateTime Day(int month, int day) => new(2026, month, day, 0, 0, 0, DateTimeKind.Utc);

    private static UsageRow Hourly(int month, int day) => new("openai", "gpt-4o-mini", AICapability.Chat, Day(month, day).AddHours(10), 1, 100);

    private static UsageRow Cleaned(int month, int day) => Hourly(month, day) with { DailyOnly = true };

    // The first hourly day is part cleaned: its early hours only have a daily row, the rest an hourly row.
    private static UsageRow Early(int month, int day) => Cleaned(month, day) with { Timestamp = Day(month, day).AddHours(3) };

    // The window of whole local days (Copenhagen) from the first date to the last, inclusive.
    private static async Task<(AICarbonUsageReader.Window Window, int Calls)> PlanAsync(
        FakeUsageAnalyticsService usage, (int Month, int Day) first, (int Month, int Day) last, int retentionDays = 30)
    {
        var options = Mock.Of<IOptionsMonitor<AIAnalyticsOptions>>(
            monitor => monitor.CurrentValue == new AIAnalyticsOptions { UsageHourlyRetentionDays = retentionDays });
        var reader = new AICarbonUsageReader(usage, options, new FixedTimeProvider(Now));
        var from = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Day(first.Month, first.Day)), Copenhagen);
        var to = AICarbonLocalDays.LocalDayStartUtc(DateOnly.FromDateTime(Day(last.Month, last.Day).AddDays(1)), Copenhagen);

        var window = await reader.CreateWindowAsync(from, to, AIUsagePeriod.Daily, Copenhagen, CancellationToken.None);

        return (window, usage.ReceivedTokens.Count);
    }

    [TestFixture]
    public class GivenTheRangeReachesTheClockLine
    {
        [Test]
        public async Task PutsTheLineAfterThePartlyCleanedFirstDay()
        {
            var usage = new FakeUsageAnalyticsService().Add(Cleaned(10, 12)).Add(Early(10, 14)).Add(Hourly(10, 14)).Add(Hourly(10, 16));

            var (window, calls) = await PlanAsync(usage, (10, 12), (10, 18));

            Assert.That((window.HourlyLine, calls), Is.EqualTo((Day(10, 15), 2)));
        }

        [Test]
        public async Task MovesTheLineBackADayWhenTheJobLastRanYesterday()
        {
            var usage = new FakeUsageAnalyticsService().Add(Cleaned(10, 12)).Add(Early(10, 13)).Add(Hourly(10, 13)).Add(Hourly(10, 14));

            var (window, calls) = await PlanAsync(usage, (10, 12), (10, 18));

            Assert.That((window.HourlyLine, calls), Is.EqualTo((Day(10, 14), 2)));
        }

        [Test]
        public async Task DoesNotLookForCleanedDaysMoreThanThreeDaysBeforeTheGuess()
        {
            // Cleaned usage on 11 October is before 12 October (the guess minus three days), so it is not seen.
            var (window, _) = await PlanAsync(new FakeUsageAnalyticsService().Add(Cleaned(10, 11)).Add(Hourly(10, 13)), (10, 5), (10, 18));

            Assert.That(window.HourlyLine, Is.EqualTo(Day(10, 12)));
        }

        [Test]
        public async Task MovesTheLineForwardWhenTheRetentionWasRaised()
        {
            // Retention 60 days puts the guess on 15 September; the rows older than 15 October are gone.
            var usage = new FakeUsageAnalyticsService().Add(Cleaned(9, 20)).Add(Early(10, 15)).Add(Hourly(10, 15)).Add(Hourly(11, 2));

            var (window, calls) = await PlanAsync(usage, (9, 15), (11, 13), retentionDays: 60);

            Assert.That((window.HourlyLine, calls), Is.EqualTo((Day(10, 16), 2)));
        }

        [Test]
        public async Task IgnoresQuietDaysAmongTheCleanedDays()
        {
            // 21 September to 9 October have no usage at all, and 11 to 14 October have none either.
            var usage = new FakeUsageAnalyticsService().Add(Cleaned(9, 20)).Add(Cleaned(10, 10)).Add(Hourly(10, 15));

            var (window, _) = await PlanAsync(usage, (9, 15), (11, 13), retentionDays: 60);

            Assert.That(window.HourlyLine, Is.EqualTo(Day(10, 11)));
        }
    }

    [TestFixture]
    public class GivenNothingShowsHourlyRowsWereCleaned
    {
        [Test]
        public async Task KeepsTheLineAtTheStartOfTheRangeOnAQuietSite()
        {
            // 11 to 13 November locally: nothing was used on 9 November (or any day before the range).
            var (window, calls) = await PlanAsync(new FakeUsageAnalyticsService().Add(Hourly(11, 12)), (11, 11), (11, 13));

            Assert.That((window.HourlyLine, calls), Is.EqualTo((Day(11, 10), 2)));
        }

        [Test]
        public async Task KeepsTheLineAtTheStartWithNoUsageAtAll()
        {
            var (window, calls) = await PlanAsync(new FakeUsageAnalyticsService(), (10, 12), (10, 18));

            Assert.That((window.HourlyLine, calls), Is.EqualTo((Day(10, 12), 2)));
        }

        [Test]
        public async Task ReadsTheWholeRangeByHour()
        {
            var (window, _) = await PlanAsync(new FakeUsageAnalyticsService().Add(Hourly(11, 12)), (11, 11), (11, 13));

            Assert.That(window.Segments.Select(segment => segment.Granularity), Is.EqualTo(new[] { AIUsagePeriod.Hourly }));
        }
    }

    [TestFixture]
    public class GivenAWindowAwayFromTheLine
    {
        [Test]
        public async Task BeyondRetentionMakesNoCalls()
        {
            var (_, calls) = await PlanAsync(new FakeUsageAnalyticsService(), (9, 1), (9, 7));

            Assert.That(calls, Is.Zero);
        }

        [Test]
        public async Task StartingInTheFutureMakesNoCalls()
        {
            var usage = new FakeUsageAnalyticsService();
            var reader = new AICarbonUsageReader(
                usage, Mock.Of<IOptionsMonitor<AIAnalyticsOptions>>(monitor => monitor.CurrentValue == new AIAnalyticsOptions()), new FixedTimeProvider(Now));

            await reader.CreateWindowAsync(Now.AddDays(1), Now.AddDays(8), AIUsagePeriod.Daily, Copenhagen, CancellationToken.None);

            Assert.That(usage.ReceivedTokens, Is.Empty);
        }

        [Test]
        public async Task HourlyBucketsMakeNoCalls()
        {
            var usage = new FakeUsageAnalyticsService();
            var reader = new AICarbonUsageReader(
                usage, Mock.Of<IOptionsMonitor<AIAnalyticsOptions>>(monitor => monitor.CurrentValue == new AIAnalyticsOptions()), new FixedTimeProvider(Now));

            await reader.CreateWindowAsync(Now.AddDays(-1), Now, AIUsagePeriod.Hourly, Copenhagen, CancellationToken.None);

            Assert.That(usage.ReceivedTokens, Is.Empty);
        }
    }

    [TestFixture]
    public class GivenTheFirstUseIsToday
    {
        [Test]
        public async Task KeepsTheLineOnTodayWhenTodayLooksCleaned()
        {
            // A record landing between the two reads makes today's daily total exceed its hourly one.
            var (window, _) = await PlanAsync(new FakeUsageAnalyticsService().Add(Cleaned(11, 13)), (11, 7), (11, 13));

            Assert.That(window.HourlyLine, Is.EqualTo(Day(11, 13)));
        }

        [Test]
        public async Task ReadsTodayFromHourlyRows()
        {
            var (window, _) = await PlanAsync(new FakeUsageAnalyticsService().Add(Cleaned(11, 13)), (11, 7), (11, 13));

            Assert.That(window.Segments.Last().Granularity, Is.EqualTo(AIUsagePeriod.Hourly));
        }

        [Test]
        public async Task KeepsTheClockLineOnTodayWhenTheRetentionIsZero()
        {
            var (window, _) = await PlanAsync(new FakeUsageAnalyticsService(), (10, 1), (10, 7), retentionDays: 0);

            Assert.That(window.HourlyLine, Is.EqualTo(Day(11, 13)));
        }
    }
}
