// Test support: a clock that stands still.
namespace Umbraco.Community.AI.Carbon.Tests.Unit.Support;

internal sealed class FixedTimeProvider(DateTime utcNow) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => new(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc));
}
