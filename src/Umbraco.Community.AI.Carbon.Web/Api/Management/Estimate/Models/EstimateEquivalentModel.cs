using System.ComponentModel.DataAnnotations;
using Umbraco.Community.AI.Carbon.Core.Estimation;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// The top of the estimate expressed as one everyday activity.
/// </summary>
public class EstimateEquivalentModel
{
    /// <summary>
    /// <c>PhoneCharges</c>, <c>CarKm</c> or <c>FlightKm</c>.
    /// </summary>
    [Required]
    public AICarbonEquivalentKind Kind { get; set; }

    /// <summary>
    /// How many of <see cref="Kind"/> the emissions equal. Not rounded.
    /// </summary>
    [Required]
    public double Amount { get; set; }

    /// <summary>
    /// The emissions (grams CO2e) the amount was worked out from: the top of the estimated range.
    /// </summary>
    [Required]
    public double BasisCo2eGrams { get; set; }

    /// <summary>
    /// The publisher of the conversion factor used.
    /// </summary>
    [Required]
    public string Source { get; set; } = string.Empty;

    /// <summary>
    /// The edition (year) of the conversion factor used.
    /// </summary>
    [Required]
    public int SourceYear { get; set; }
}
