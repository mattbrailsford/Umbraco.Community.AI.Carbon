import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Mirrors Umbraco.AI: @umbraco-ui/uui imports a bare directory that Node's ESM resolver
        // rejects, so backoffice packages are transformed by Vite rather than externalised.
        server: { deps: { inline: [/@umbraco-ui\//, /@umbraco-cms\//] } },
        environment: "happy-dom",
        include: ["src/**/*.test.ts"],
        // Pending specs (see docs/plans/*/PLAN.md) are renamed by the builder when their task starts.
        exclude: ["src/**/*.pending.test.ts", "**/node_modules/**"],
        passWithNoTests: true,
    },
});
