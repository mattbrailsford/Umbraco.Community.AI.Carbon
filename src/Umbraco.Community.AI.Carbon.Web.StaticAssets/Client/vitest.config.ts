import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const stub = (file: string) => fileURLToPath(new URL(`./src/test-support/analytics-ui/${file}`, import.meta.url));

export default defineConfig({
    // The npm package is types only (the runtime comes from the NuGet package via the backoffice import map),
    // so tests import local stubs. The longer path must come first. tsc still resolves the real types.
    resolve: {
        alias: [
            { find: /^@umbraco\/analytics-ui\/external\/chart\.js$/, replacement: stub("chart.stub.ts") },
            { find: /^@umbraco\/analytics-ui$/, replacement: stub("analytics-ui.stub.ts") },
        ],
    },
    test: {
        // Mirrors Umbraco.AI: @umbraco-ui/uui imports a bare directory that Node's ESM resolver
        // rejects, so backoffice packages are transformed by Vite rather than externalised.
        server: { deps: { inline: [/@umbraco-ui\//, /@umbraco-cms\//] } },
        environment: "happy-dom",
        // Node 25+ enables its own `localStorage` global by default (22-24 behind a flag); without
        // a storage file it is undefined and shadows happy-dom's. Turn it off so tests get happy-dom's.
        execArgv: ["--no-experimental-webstorage"],
        include: ["src/**/*.test.ts"],
        // Pending specs (see docs/plans/*/PLAN.md) are renamed by the builder when their task starts.
        exclude: ["src/**/*.pending.test.ts", "**/node_modules/**"],
        passWithNoTests: true,
    },
});
