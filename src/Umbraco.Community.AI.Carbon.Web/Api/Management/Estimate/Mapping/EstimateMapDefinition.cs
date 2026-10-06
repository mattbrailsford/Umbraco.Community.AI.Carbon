using Umbraco.Cms.Core.Mapping;
using Umbraco.Community.AI.Carbon.Core;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Mapping;

/// <summary>
/// Maps the Core estimate to the Management API response, the one place the wire shape is decided.
/// </summary>
public class EstimateMapDefinition : IMapDefinition
{
    /// <inheritdoc />
    public void DefineMaps(IUmbracoMapper mapper)
        => mapper.Define<AICarbonEstimate, EstimateResponseModel>((_, _) => new EstimateResponseModel(), MapEstimate);

    // Umbraco.Code.MapAll
    private static void MapEstimate(AICarbonEstimate source, EstimateResponseModel target, MapperContext context)
    {
        target.From = AsUtc(source.From);
        target.To = AsUtc(source.To);
        target.Granularity = source.Granularity;
        target.Total = new EstimateTotalModel
        {
            Co2eGrams = MapRange(source.Total.Co2eGrams),
            EnergyWh = MapRange(source.Total.EnergyWh),
            Requests = source.Total.Requests,
            OutputTokens = source.Total.OutputTokens,
            Equivalent = source.Total.Equivalent is { } equivalent ? MapEquivalent(equivalent) : null,
        };
        target.ByModel = source.ByModel.Select(MapModelRow).ToList();
        target.ByFeature = new EstimateFeatureBreakdownModel
        {
            Available = source.ByFeature.Available,
            Items = source.ByFeature.Items
                .Select(item => new EstimateFeatureItemModel
                {
                    FeatureType = item.FeatureType,
                    Co2eGrams = MapRange(item.Co2eGrams),
                    Requests = item.Requests,
                })
                .ToList(),
        };
        target.TimeSeries = source.TimeSeries
            .Select(point => new EstimateTimeSeriesPointModel
            {
                Timestamp = AsUtc(point.Timestamp),
                Co2eGrams = MapRange(point.Co2eGrams),
            })
            .ToList();
        target.NotEstimated = new EstimateNotEstimatedModel
        {
            Requests = source.NotEstimated.Requests,
            OutputTokens = source.NotEstimated.OutputTokens,
            Models = source.NotEstimated.Models,
        };
        target.Method = new EstimateMethodModel
        {
            Source = source.Method.Source,
            DataVersion = source.Method.DataVersion,
            ElectricityZone = source.Method.ElectricityZone,
            ElectricityZones = source.Method.ElectricityZones.ToList(),
            ZoneIsOverride = source.Method.ZoneIsOverride,
            AnalyticsEnabled = source.Method.AnalyticsEnabled,
        };
    }

    private static EstimateModelRowModel MapModelRow(AICarbonModelEstimate row) => new()
    {
        ProviderId = row.ProviderId,
        ModelId = row.ModelId,
        MatchedAs = row.MatchedAs,
        ElectricityZone = row.ElectricityZone,
        Status = row.Status,
        Co2eGrams = row.Co2eGrams is { } range ? MapRange(range) : null,
        Requests = row.Requests,
        OutputTokens = row.OutputTokens,
        Warnings = row.Warnings.ToList(),
    };

    private static EstimateEquivalentModel MapEquivalent(AICarbonEquivalent equivalent) => new()
    {
        Kind = equivalent.Kind,
        Amount = equivalent.Amount,
        BasisCo2eGrams = equivalent.BasisCo2eGrams,
        Source = equivalent.Source,
        SourceYear = equivalent.SourceYear,
    };

    private static EstimateRangeModel MapRange(RangeValue range) => new() { Min = range.Min, Max = range.Max };

    // System.Text.Json writes a trailing Z only for DateTimeKind.Utc. Core times are UTC but may carry any kind.
    // (A DateTimeOffset would write +00:00 instead.)
    private static DateTime AsUtc(DateTime utc) => DateTime.SpecifyKind(utc, DateTimeKind.Utc);
}
