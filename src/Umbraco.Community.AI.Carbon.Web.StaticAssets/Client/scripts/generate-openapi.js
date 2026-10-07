import chalk from "chalk";
import { createClient, defaultPlugins } from "@hey-api/openapi-ts";
import { getPort } from "worktree-dev-port";

const documentName = process.argv[2];
if (documentName === undefined) {
    console.error(chalk.red("ERROR: Missing OpenAPI document name (e.g. ai-carbon-management)"));
    process.exit(1);
}

// The demo site's port is per worktree (Umbraco.Community.WorktreeDevPort); the site must have run
// in this worktree at least once.
let port;
try {
    port = getPort();
} catch (error) {
    console.error(chalk.red(`ERROR: ${error.message}`));
    process.exit(1);
}

const swaggerUrl = `https://127.0.0.1:${port}/umbraco/swagger/${documentName}/swagger.json`;
console.log(chalk.cyan(`Using ${swaggerUrl}`));

// Local dev server uses a self-signed certificate.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

fetch(swaggerUrl)
    .then(async (response) => {
        if (!response.ok) {
            console.error(chalk.red(`ERROR: Failed to fetch OpenAPI spec from ${swaggerUrl} (${response.status})`));
            process.exit(1);
        }

        await createClient({
            input: swaggerUrl,
            output: "src/api",
            plugins: [
                ...defaultPlugins,
                "@hey-api/client-fetch",
                {
                    name: "@hey-api/sdk",
                    asClass: true,
                    classNameBuilder: "{{name}}Service",
                },
            ],
        });

        console.log(chalk.green("Generated OpenAPI client in src/api"));
    })
    .catch((error) => {
        console.error(chalk.red(`ERROR: ${error.message}`));
        process.exit(1);
    });
