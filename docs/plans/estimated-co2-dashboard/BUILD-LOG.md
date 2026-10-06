# Build log

- 06-10-2026 T1 29ed422: EcoLogits 0.11.2 data embedded (byte-identical, checked by reviewer), provider config port verified value by value; 46 unit tests green. 1 review fix round (non-null zone, alias semantics, pinning tests).
- 06-10-2026 T2 852e09d: options + never-throw startup validation; reviewer ran the real validator against JSON config (null/blank/array values); 112 unit tests green. 1 fix round (null provider mapping crashed boot).
- 06-10-2026 T3 b3a4805: calculator port; reviewer compared 696 cases (348 models x 2 zones) against EcoLogits 0.11.2, max relative error 4.4e-16; 141 unit tests. 1 fix round (SA1407, input validation).
- 06-10-2026 T4 c4a8f15: resolver chain; reviewer probed ~110 real provider ids (zero false positives) and bound real JSON through DI; 216 unit tests. 1 fix round (colon keys dropped by config binding, resolver exception guard, vendor aliases, dot/-Turbo fallbacks).
- 06-10-2026 T5 f975371: estimate service (totals + by model); reviewer compared the fake with Umbraco.AI v18/dev analytics and confirmed the 18.0.0 floor API; 247 unit tests. 1 fix round (missing tests, fake caveats, IOptionsMonitor).
