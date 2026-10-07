using System.ComponentModel.DataAnnotations;
using Umbraco.AI.Core.Analytics.Usage;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// An estimate of the CO2e of Umbraco.AI usage in a period, as returned by the Management API.
/// All figures are estimates.
/// </summary>
public class EstimateResponseModel
{
    /// <summary>
    /// Start of the period (inclusive), in UTC (serialised with a trailing Z).
    /// </summary>
    [Required]
    public DateTime From { get; set; }

    /// <summary>
    /// End of the period (exclusive), in UTC (serialised with a trailing Z).
    /// </summary>
    [Required]
    public DateTime To { get; set; }

    /// <summary>
    /// The bucket size used: <c>Hourly</c> or <c>Daily</c>.
    /// </summary>
    [Required]
    public AIUsagePeriod Granularity { get; set; }

    /// <summary>
    /// The sum of everything that could be estimated.
    /// </summary>
    [Required]
    public EstimateTotalModel Total { get; set; } = new();

    /// <summary>
    /// One row per provider and model, including those that could not be estimated.
    /// </summary>
    [Required]
    public IReadOnlyList<EstimateModelRowModel> ByModel { get; set; } = [];

    /// <summary>
    /// The split by feature type.
    /// </summary>
    [Required]
    public EstimateFeatureBreakdownModel ByFeature { get; set; } = new();

    /// <summary>
    /// One point per bucket in the period, zeros included.
    /// </summary>
    [Required]
    public IReadOnlyList<EstimateTimeSeriesPointModel> TimeSeries { get; set; } = [];

    /// <summary>
    /// Usage that was counted but not estimated.
    /// </summary>
    [Required]
    public EstimateNotEstimatedModel NotEstimated { get; set; } = new();

    /// <summary>
    /// How the figures were calculated.
    /// </summary>
    [Required]
    public EstimateMethodModel Method { get; set; } = new();
}
