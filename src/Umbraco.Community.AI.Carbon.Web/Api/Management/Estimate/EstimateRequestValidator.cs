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
    /// <returns>The problem, or <c>null</c>.</returns>
    public static EstimateRequestProblem? Validate(DateTime from, DateTime to, AIUsagePeriod? granularity)
    {
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
}

/// <summary>A reason an estimate request was rejected.</summary>
/// <param name="Field">The query field at fault.</param>
/// <param name="Message">What is wrong with it.</param>
internal sealed record EstimateRequestProblem(string Field, string Message);
