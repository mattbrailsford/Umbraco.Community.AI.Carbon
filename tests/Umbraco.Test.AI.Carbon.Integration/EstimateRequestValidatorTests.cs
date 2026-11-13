// Task 7b — the optional timeZone query parameter of GET /estimate.
using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate;

namespace Umbraco.Community.AI.Carbon.Tests.Integration;

[TestFixture]
public class EstimateRequestValidatorTests
{
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    private static EstimateRequestProblem? Validate(string? timeZone)
        => EstimateRequestValidator.Validate(From, From.AddDays(7), null, timeZone);

    [Test]
    public void RejectsAnUnknownTimeZoneNamingTheField()
        => Assert.That(Validate("Mars/Olympus_Mons")?.Field, Is.EqualTo("timeZone"));

    [Test]
    public void ExplainsWhatAZoneShouldLookLike()
        => Assert.That(Validate("Mars/Olympus_Mons")?.Message, Does.Contain("IANA"));

    [Test]
    public void AcceptsAnIanaName()
        => Assert.That(Validate("Europe/Copenhagen"), Is.Null);

    [Test]
    public void AcceptsNoTimeZone()
        => Assert.That(Validate(null), Is.Null);

    [Test]
    public void TreatsWhiteSpaceAsNoTimeZone()
        => Assert.That(Validate("  "), Is.Null);

    [Test]
    public void TrimsTheNameBeforeLookingItUp()
    {
        EstimateRequestValidator.TryFindTimeZone(" Europe/Copenhagen ", out var zone);

        Assert.That(zone?.Id, Is.EqualTo("Europe/Copenhagen"));
    }

    [Test]
    public void TreatsAnEmptyTimeZoneAsNone()
        => Assert.That(Validate(string.Empty), Is.Null);

    [Test]
    public void FindsNoZoneForUtcDays()
    {
        EstimateRequestValidator.TryFindTimeZone(null, out var zone);

        Assert.That(zone, Is.Null);
    }

    [Test]
    public void FindsTheNamedZone()
    {
        EstimateRequestValidator.TryFindTimeZone("America/New_York", out var zone);

        Assert.That(zone?.Id, Is.EqualTo("America/New_York"));
    }
}
