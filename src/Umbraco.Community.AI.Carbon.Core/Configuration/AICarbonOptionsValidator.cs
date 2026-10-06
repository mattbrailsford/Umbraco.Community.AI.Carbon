using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Configuration;

/// <summary>
/// Checks <see cref="AICarbonOptions"/> against the EcoLogits data and logs a warning for every value that
/// cannot be used. It never throws: a bad setting must not stop the site from starting.
/// </summary>
internal sealed class AICarbonOptionsValidator
{
    private readonly IEcoLogitsDataRepository _data;
    private readonly IOptions<AICarbonOptions> _options;
    private readonly ILogger<AICarbonOptionsValidator> _logger;

    /// <summary>Initializes a new instance of the <see cref="AICarbonOptionsValidator"/> class.</summary>
    /// <param name="data">The EcoLogits reference data.</param>
    /// <param name="options">The options to validate.</param>
    /// <param name="logger">The logger warnings are written to.</param>
    public AICarbonOptionsValidator(
        IEcoLogitsDataRepository data,
        IOptions<AICarbonOptions> options,
        ILogger<AICarbonOptionsValidator> logger)
    {
        _data = data;
        _options = options;
        _logger = logger;
    }

    /// <summary>Logs a warning for each unusable setting.</summary>
    public void Validate()
    {
        var options = _options.Value;
        ValidateElectricityZone(options);
        ValidateProviderMappings(options);
        ValidateModelMappings(options);
    }

    private void ValidateElectricityZone(AICarbonOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.ElectricityZone)
            && _data.GetElectricityMix(options.ElectricityZone) is null)
        {
            _logger.LogWarning(
                "AICarbon:ElectricityZone '{Zone}' is not a known EcoLogits electricity zone. Each provider's default zone will be used instead.",
                options.ElectricityZone);
        }
    }

    private void ValidateProviderMappings(AICarbonOptions options)
    {
        foreach (var (key, value) in options.ProviderMappings)
        {
            if (string.IsNullOrWhiteSpace(value) || !_data.ProviderExists(value))
            {
                _logger.LogWarning(
                    "AICarbon:ProviderMappings '{Key}' maps to '{Value}', which is not an EcoLogits provider. The mapping will be ignored.",
                    key,
                    value);
            }
        }
    }

    private void ValidateModelMappings(AICarbonOptions options)
    {
        foreach (var (key, value) in options.ModelMappings)
        {
            if (!ModelMappingTarget.TryParse(value, out var target))
            {
                _logger.LogWarning(
                    "AICarbon:ModelMappings '{Key}' has value '{Value}', which is not in 'provider/model' form. The mapping will be ignored.",
                    key,
                    value);
            }
            else if (_data.GetModel(target.Provider, target.Name) is null)
            {
                _logger.LogWarning(
                    "AICarbon:ModelMappings '{Key}' maps to '{Value}', which is not a model EcoLogits knows. The mapping will be ignored.",
                    key,
                    value);
            }
        }
    }
}
