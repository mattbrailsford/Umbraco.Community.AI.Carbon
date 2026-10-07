using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;

namespace Umbraco.Community.AI.Carbon.Core.Configuration;

/// <summary>
/// Runs <see cref="AICarbonOptionsValidator"/> once when Umbraco starts.
/// </summary>
internal sealed class AICarbonOptionsValidationHandler : INotificationHandler<UmbracoApplicationStartingNotification>
{
    private readonly AICarbonOptionsValidator _validator;
    private readonly ILogger<AICarbonOptionsValidationHandler> _logger;

    /// <summary>Initializes a new instance of the <see cref="AICarbonOptionsValidationHandler"/> class.</summary>
    /// <param name="validator">The validator to run.</param>
    /// <param name="logger">The logger used if validation itself fails.</param>
    public AICarbonOptionsValidationHandler(AICarbonOptionsValidator validator, ILogger<AICarbonOptionsValidationHandler> logger)
    {
        _validator = validator;
        _logger = logger;
    }

    /// <inheritdoc />
    public void Handle(UmbracoApplicationStartingNotification notification)
    {
        try
        {
            _validator.Validate();
        }
#pragma warning disable CA1031 // Diagnostics must never stop the site from starting.
        catch (Exception ex)
#pragma warning restore CA1031
        {
            _logger.LogError(ex, "AICarbon configuration validation failed unexpectedly. The configuration was not checked.");
        }
    }
}
