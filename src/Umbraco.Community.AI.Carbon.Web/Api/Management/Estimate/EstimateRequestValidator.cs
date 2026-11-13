using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.Community.AI.Carbon.Core.Estimation;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate;

/// <summary>
/// Checks an estimate request before it reaches the service, so the caller gets a 400 that names the field.
/// The window rules come from Core (<see cref="AICarbonEstimateLimits"/> and its granularity resolution), not a copy of them.
/// </summary>
internal static class EstimateRequestValidator
{
    // Bucket arithmetic steps a day past the last bucket (and the series starts a day before it), so instants this
    // close to the ends of the DateTime range would overflow.
    private static readonly TimeSpan OverflowMargin = TimeSpan.FromDays(2);

    /// <summary>The first problem with the request, or <c>null</c> when it is valid.</summary>
    /// <param name="from">The requested start.</param>
    /// <param name="to">The requested end.</param>
    /// <param name="granularity">The requested bucket size, if any.</param>
    /// <param name="timeZone">The requested IANA time zone name, if any.</param>
    /// <returns>The problem, or <c>null</c>.</returns>
    public static EstimateRequestProblem? Validate(DateTime from, DateTime to, AIUsagePeriod? granularity, string? timeZone = null)
    {
        if (!TryFindTimeZone(timeZone, out _))
        {
            return new EstimateRequestProblem("timeZone", "The time zone must be an IANA time zone name, such as Europe/Copenhagen.");
        }

        if (granularity is { } requested && !Enum.IsDefined(requested))
        {
            return new EstimateRequestProblem("granularity", "Granularity must be Hourly or Daily.");
        }

        var fromUtc = AICarbonEstimateWindow.ToUtc(from);
        var toUtc = AICarbonEstimateWindow.ToUtc(to);

        if (fromUtc < DateTime.MinValue + OverflowMargin)
        {
            return new EstimateRequestProblem("from", "The start of the period is too early.");
        }

        if (toUtc > DateTime.MaxValue - OverflowMargin)
        {
            return new EstimateRequestProblem("to", "The end of the period is too late.");
        }

        if (fromUtc >= toUtc)
        {
            return new EstimateRequestProblem("from", "The start of the period must be before its end.");
        }

        var bucket = AICarbonEstimateWindow.ResolveGranularity(granularity, fromUtc, toUtc);
        var maxDays = AICarbonEstimateWindow.MaxWindowDays(bucket);
        if ((toUtc - fromUtc).TotalDays > maxDays)
        {
            return new EstimateRequestProblem(
                "to",
                $"A period with {bucket.ToString().ToLowerInvariant()} buckets can span at most {maxDays} days.");
        }

        return null;
    }

    /// <summary>Finds a time zone by its IANA name; <c>null</c>, empty or white space means none (UTC days), and the name is trimmed.</summary>
    /// <param name="name">The requested name.</param>
    /// <param name="timeZone">The zone, or <c>null</c> when none was asked for.</param>
    /// <returns><c>false</c> when a name was given that is not a known zone.</returns>
    public static bool TryFindTimeZone(string? name, out TimeZoneInfo? timeZone)
    {
        timeZone = null;
        return string.IsNullOrWhiteSpace(name) || TimeZoneInfo.TryFindSystemTimeZoneById(name.Trim(), out timeZone);
    }
}

/// <summary>A reason an estimate request was rejected.</summary>
/// <param name="Field">The query field at fault.</param>
/// <param name="Message">What is wrong with it.</param>
internal sealed record EstimateRequestProblem(string Field, string Message);
