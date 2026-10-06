# Build log

- 06-10-2026 T1 29ed422: EcoLogits 0.11.2 data embedded (byte-identical, checked by reviewer), provider config port verified value by value; 46 unit tests green. 1 review fix round (non-null zone, alias semantics, pinning tests).
- 06-10-2026 T2 852e09d: options + never-throw startup validation; reviewer ran the real validator against JSON config (null/blank/array values); 112 unit tests green. 1 fix round (null provider mapping crashed boot).
- 06-10-2026 T3 b3a4805: calculator port; reviewer compared 696 cases (348 models x 2 zones) against EcoLogits 0.11.2, max relative error 4.4e-16; 141 unit tests. 1 fix round (SA1407, input validation).
