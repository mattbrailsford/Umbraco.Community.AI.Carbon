using System.ComponentModel.DataAnnotations;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// The estimate split by Umbraco.AI feature type.
/// </summary>
public class EstimateFeatureBreakdownModel
{
    /// <summary>
    /// Whether the split could be made; <c>false</c> when Umbraco.AI's feature type dimension (or analytics) is off.
    /// </summary>
    [Required]
    public bool Available { get; set; }

    /// <summary>
    /// The split; empty when not available.
    /// </summary>
    [Required]
    public IReadOnlyList<EstimateFeatureItemModel> Items { get; set; } = [];
}
