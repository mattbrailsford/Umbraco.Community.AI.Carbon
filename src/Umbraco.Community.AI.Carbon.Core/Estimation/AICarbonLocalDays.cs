using Umbraco.AI.Core.Analytics.Usage;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Local-day arithmetic for Daily estimates, matching how Umbraco.AI's Usage tab (<c>AIUsageOverviewService</c>)
/// puts its rows on a viewer's days, so the two tabs count the same requests.
/// </summary>
internal static class AICarbonLocalDays
{
    /// <summary>One read against Umbraco.AI's statistics: a window and the row size it is read at.</summary>
    /// <param name="From">Start of the read (inclusive).</param>
    /// <param name="To">End of the read (exclusive).</param>
    /// <param name="Granularity">The row size read, which is also how the rows' timestamps are to be understood.</param>
    /// <param name="MiddayRule">
    /// Whether the rows are UTC days that belong to the local day their midday falls on (the read window is then
    /// shifted back twelve hours). Otherwise they are hours that belong to the local day they start on.
    /// </param>
    internal readonly record struct Segment(DateTime From, DateTime To, AIUsagePeriod Granularity, bool MiddayRule);

    /// <summary>
    /// The clock's guess at where hourly rows start: the first UTC midnight at or after the hourly retention
    /// period before now. The cleanup job runs once a day and an admin can change the retention, so the data
    /// can start a day or more away from it; <see cref="AICarbonUsageReader"/> checks the data near it.
    /// </summary>
    /// <param name="hourlyRetentionDays">Umbraco.AI's <c>UsageHourlyRetentionDays</c>.</param>
    /// <param name="nowUtc">The current time.</param>
    /// <returns>A UTC midnight.</returns>
    public static DateTime ClockLine(int hourlyRetentionDays, DateTime nowUtc) => CeilingToDay(nowUtc.AddDays(-hourlyRetentionDays));

    /// <summary>
    /// Plans the reads for a window. Without a zone, or for Hourly buckets (already exact), that is the window as
    /// asked. For Daily buckets in a zone it is split at the hourly line: hours (whole, so the window's edges are
    /// rounded up to the hour like Umbraco.AI's Usage tab does) at and after it, and UTC daily rows before it,
    /// read twelve hours earlier because daily rows are selected by their midnight and a day belongs to a window
    /// when its midday does.
    /// </summary>
    /// <param name="from">Start of the window (UTC, inclusive).</param>
    /// <param name="to">End of the window (UTC, exclusive).</param>
    /// <param name="bucket">The bucket size of the estimate.</param>
    /// <param name="timeZone">The viewer's zone, or <c>null</c> for UTC days.</param>
    /// <param name="hourlyLine">The UTC midnight from which days are read from hourly rows.</param>
    /// <returns>The reads, oldest first; empty parts are left out.</returns>
    public static IReadOnlyList<Segment> Plan(
        DateTime from, DateTime to, AIUsagePeriod bucket, TimeZoneInfo? timeZone, DateTime hourlyLine)
    {
        if (timeZone is null || bucket != AIUsagePeriod.Daily)
        {
            return [new Segment(from, to, bucket, MiddayRule: false)];
        }

        var segments = new List<Segment>(2);
        var dailyFrom = from.AddHours(-12);
        var dailyTo = Earliest(to.AddHours(-12), hourlyLine);

        // Daily rows are selected by their UTC midnight, so a read with no midnight in it has nothing to find
        // and is not made.
        if (CeilingToDay(dailyFrom) < dailyTo)
        {
            segments.Add(new Segment(dailyFrom, dailyTo, AIUsagePeriod.Daily, MiddayRule: true));
        }

        var hourFrom = Latest(CeilingToHour(from), hourlyLine);
        var hourTo = CeilingToHour(to);
        if (hourFrom < hourTo)
        {
            segments.Add(new Segment(hourFrom, hourTo, AIUsagePeriod.Hourly, MiddayRule: false));
        }

        return segments;
    }

    /// <summary>The start instant of the local day a row's timestamp belongs to.</summary>
    /// <param name="timestamp">The row's UTC timestamp (hour start, or midnight of a UTC day).</param>
    /// <param name="segment">The read the row came from.</param>
    /// <param name="timeZone">The viewer's zone.</param>
    /// <returns>The local day's start, UTC.</returns>
    public static DateTime LocalDayStartOf(DateTime timestamp, Segment segment, TimeZoneInfo timeZone)
        => LocalDayStartUtc(LocalDate(segment.MiddayRule ? timestamp.AddHours(12) : timestamp, timeZone), timeZone);

    /// <summary>The local date an instant falls on.</summary>
    /// <param name="utc">The instant.</param>
    /// <param name="timeZone">The zone.</param>
    /// <returns>The date.</returns>
    public static DateOnly LocalDate(DateTime utc, TimeZoneInfo timeZone)
        => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), timeZone));

    /// <summary>
    /// The UTC instant a local day starts at; the same rule as Umbraco.AI's <c>LocalDayStartUtc</c>. A day whose
    /// midnight does not exist (a clock change at midnight) starts at the first time that does, and one whose
    /// midnight happens twice starts at the first of them.
    /// </summary>
    /// <param name="day">The local date.</param>
    /// <param name="timeZone">The zone.</param>
    /// <returns>The start, UTC.</returns>
    public static DateTime LocalDayStartUtc(DateOnly day, TimeZoneInfo timeZone)
    {
        var local = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);

        while (timeZone.IsInvalidTime(local))
        {
            local = local.AddMinutes(30);
        }

        if (timeZone.IsAmbiguousTime(local))
        {
            // The larger offset is the earlier instant.
            var offset = timeZone.GetAmbiguousTimeOffsets(local).Max();
            return DateTime.SpecifyKind(local - offset, DateTimeKind.Utc);
        }

        return DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeToUtc(local, timeZone), DateTimeKind.Utc);
    }

    private static DateTime Earliest(DateTime a, DateTime b) => a < b ? a : b;

    private static DateTime Latest(DateTime a, DateTime b) => a > b ? a : b;

    private static DateTime CeilingToHour(DateTime utc)
    {
        var hour = new DateTime(utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, DateTimeKind.Utc);
        return hour < utc ? hour.AddHours(1) : hour;
    }

    private static DateTime CeilingToDay(DateTime utc)
    {
        var day = new DateTime(utc.Year, utc.Month, utc.Day, 0, 0, 0, DateTimeKind.Utc);
        return day < utc ? day.AddDays(1) : day;
    }
}
