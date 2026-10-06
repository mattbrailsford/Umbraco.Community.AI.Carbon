// S1 — "the same request within 5 minutes may return a cached result". Task: T10.
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using NUnit.Framework;
using Umbraco.AI.Core.Analytics;
using Umbraco.AI.Core.Analytics.Usage;
using Umbraco.AI.Core.Models;
using Umbraco.Cms.Core.Cache;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Core.Resolution;
using Umbraco.Community.AI.Carbon.Tests.Unit.Support;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class EstimateCacheTests
{
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    // Counts the calls that reach the calculating service, which is the real one over fake usage.
    private sealed class CountingEstimateService : IAICarbonEstimateService
    {
        private readonly IAICarbonEstimateService _real;

        public CountingEstimateService(IAICarbonEstimateService real) => _real = real;

        public int Calls { get; private set; }

        public Task<AICarbonEstimate> GetEstimateAsync(DateTime from, DateTime to, AIUsagePeriod? granularity, CancellationToken cancellationToken = default)
        {
            Calls++;
            cancellationToken.ThrowIfCancellationRequested();
            return _real.GetEstimateAsync(from, to, granularity, cancellationToken);
        }
    }

    // Owns everything the cache reads, so a test can change a setting between two calls.
    private sealed class Harness
    {
        private readonly AICarbonOptions _carbonOptions = new();
        private readonly AIAnalyticsOptions _analyticsOptions = new() { Enabled = true, IncludeUsageFeatureTypeDimension = true };

        public Harness(TimeSpan? duration = null)
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("anthropic", "claude-sonnet-4-5", AICapability.Chat, From.AddDays(1), 1, 1000));
            var data = EcoLogitsDataRepository.LoadEmbedded();
            var carbonMonitor = Mock.Of<IOptionsMonitor<AICarbonOptions>>(m => m.CurrentValue == _carbonOptions);
            var analyticsMonitor = Mock.Of<IOptionsMonitor<AIAnalyticsOptions>>(m => m.CurrentValue == _analyticsOptions);
            var resolvers = new List<IAICarbonModelResolver>
            {
                new DirectProviderResolver(data, Options.Create(_carbonOptions)),
                new NormalizedNameResolver(data, NullLogger<NormalizedNameResolver>.Instance),
            };
            var factors = new ModelFactorResolver(
                new AICarbonModelResolverCollection(() => resolvers),
                data,
                new CarbonFactorCalculator(),
                carbonMonitor,
                NullLogger<ModelFactorResolver>.Instance);

            Inner = new CountingEstimateService(new AICarbonEstimateService(usage, analyticsMonitor, data, factors, new AICarbonFeatureSplitter(usage)));
            Cache = new CachedAICarbonEstimateService(Inner, new ObjectCacheAppCache(), analyticsMonitor, factors, duration ?? CachedAICarbonEstimateService.Duration);
        }

        public CountingEstimateService Inner { get; }

        public CachedAICarbonEstimateService Cache { get; }

        public string? ZoneOverride { set => _carbonOptions.ElectricityZone = value; }

        public bool AnalyticsEnabled { set => _analyticsOptions.Enabled = value; }

        public bool FeatureDimension { set => _analyticsOptions.IncludeUsageFeatureTypeDimension = value; }
    }

    [TestFixture]
    public class GivenTheSameRequestTwice
    {
        private Harness _harness = null!;

        [SetUp]
        public async Task SetUp()
        {
            _harness = new Harness();
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void ComputesItOnce() => Assert.That(_harness.Inner.Calls, Is.EqualTo(1));
    }

    [TestFixture]
    public class GivenLocalAndUtcFormsOfTheSameInstants
    {
        private Harness _harness = null!;

        [SetUp]
        public async Task SetUp()
        {
            _harness = new Harness();
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);
            await _harness.Cache.GetEstimateAsync(From.ToLocalTime(), From.AddDays(7).ToLocalTime(), null);
        }

        [Test]
        public void ShareOneEntry() => Assert.That(_harness.Inner.Calls, Is.EqualTo(1));
    }

    [TestFixture]
    public class GivenAutomaticAndMatchingExplicitGranularity
    {
        private Harness _harness = null!;

        [SetUp]
        public async Task SetUp()
        {
            _harness = new Harness();
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), AIUsagePeriod.Hourly);
        }

        [Test]
        public void ShareOneEntry() => Assert.That(_harness.Inner.Calls, Is.EqualTo(1));
    }

    [TestFixture]
    public class GivenADifferentInput
    {
        private Harness _harness = null!;

        [SetUp]
        public async Task SetUp()
        {
            _harness = new Harness();
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public async Task AnotherFromComputesAgain()
        {
            await _harness.Cache.GetEstimateAsync(From.AddHours(1), From.AddDays(7), null);

            Assert.That(_harness.Inner.Calls, Is.EqualTo(2));
        }

        [Test]
        public async Task AnotherToComputesAgain()
        {
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(6), null);

            Assert.That(_harness.Inner.Calls, Is.EqualTo(2));
        }

        [Test]
        public async Task AnotherGranularityComputesAgain()
        {
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), AIUsagePeriod.Daily);

            Assert.That(_harness.Inner.Calls, Is.EqualTo(2));
        }

        [Test]
        public async Task AnotherZoneOverrideComputesAgain()
        {
            _harness.ZoneOverride = "SWE";

            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);

            Assert.That(_harness.Inner.Calls, Is.EqualTo(2));
        }

        [Test]
        public async Task AnUnknownZoneOverrideSharesTheEntryWithNoOverride()
        {
            _harness.ZoneOverride = "XYZ";

            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);

            Assert.That(_harness.Inner.Calls, Is.EqualTo(1));
        }

        [Test]
        public async Task AnalyticsBeingSwitchedOffComputesAgain()
        {
            _harness.AnalyticsEnabled = false;

            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);

            Assert.That(_harness.Inner.Calls, Is.EqualTo(2));
        }

        [Test]
        public async Task TheFeatureDimensionBeingSwitchedOffComputesAgain()
        {
            _harness.FeatureDimension = false;

            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);

            Assert.That(_harness.Inner.Calls, Is.EqualTo(2));
        }
    }

    [TestFixture]
    public class GivenAnInvalidWindowTwice
    {
        private Harness _harness = null!;
        private ArgumentException? _second;

        [SetUp]
        public async Task SetUp()
        {
            _harness = new Harness();
            try
            {
                await _harness.Cache.GetEstimateAsync(From, From, null);
            }
            catch (ArgumentException)
            {
                // expected: the point is the second call
            }

            try
            {
                await _harness.Cache.GetEstimateAsync(From, From, null);
            }
            catch (ArgumentException ex)
            {
                _second = ex;
            }
        }

        [Test]
        public void ItThrowsTheSecondTimeToo() => Assert.That(_second, Is.Not.Null);

        [Test]
        public void EachCallReachesTheCalculatingService() => Assert.That(_harness.Inner.Calls, Is.EqualTo(2));
    }

    [TestFixture]
    public class GivenACancelledFirstCall
    {
        private Harness _harness = null!;
        private AICarbonEstimate _second = null!;

        [SetUp]
        public async Task SetUp()
        {
            _harness = new Harness();
            using var cancelled = new CancellationTokenSource();
            await cancelled.CancelAsync();
            try
            {
                await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null, cancelled.Token);
            }
            catch (OperationCanceledException)
            {
                // expected: the point is what the next call does
            }

            _second = await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void TheSecondCallComputesAnEstimate() => Assert.That(_second.Total.Requests, Is.EqualTo(1));

        [Test]
        public void TheSecondCallReachesTheCalculatingService() => Assert.That(_harness.Inner.Calls, Is.EqualTo(2));
    }

    [TestFixture]
    public class GivenTheEntryHasExpired
    {
        private Harness _harness = null!;

        [SetUp]
        public async Task SetUp()
        {
            _harness = new Harness(TimeSpan.FromMilliseconds(50));
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);
            await Task.Delay(250);
            await _harness.Cache.GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void ItIsComputedAgain() => Assert.That(_harness.Inner.Calls, Is.EqualTo(2));
    }

    [Test]
    public void TheDefaultLifetimeIsFiveMinutes()
        => Assert.That(CachedAICarbonEstimateService.Duration, Is.EqualTo(TimeSpan.FromMinutes(5)));
}
