namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The everyday unit an <see cref="AICarbonEquivalent"/> is expressed in.
/// </summary>
public enum AICarbonEquivalentKind
{
    /// <summary>Smartphones charged.</summary>
    PhoneCharges,

    /// <summary>Kilometres driven in an average car.</summary>
    CarKm,

    /// <summary>Kilometres flown, per passenger, on a short-haul flight.</summary>
    FlightKm,
}
