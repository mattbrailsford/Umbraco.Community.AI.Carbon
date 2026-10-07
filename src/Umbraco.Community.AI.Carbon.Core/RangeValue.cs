namespace Umbraco.Community.AI.Carbon.Core;

/// <summary>
/// An inclusive minimum/maximum pair. Estimates are carried as ranges end to end, because
/// closed models only have a published size range.
/// </summary>
/// <param name="Min">The lower bound.</param>
/// <param name="Max">The upper bound.</param>
public readonly record struct RangeValue(double Min, double Max)
{
    /// <summary>Creates a range where the minimum and maximum are the same value.</summary>
    /// <param name="value">The single value.</param>
    /// <returns>A range with <see cref="Min"/> equal to <see cref="Max"/>.</returns>
    public static RangeValue Of(double value) => new(value, value);
}
