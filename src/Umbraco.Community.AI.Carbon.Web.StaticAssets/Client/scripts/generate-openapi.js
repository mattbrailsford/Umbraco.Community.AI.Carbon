import chalk from "chalk";
import { createClient, defaultPlugins } from "@hey-api/openapi-ts";

const swaggerUrl = process.argv[2];
if (swaggerUrl === undefined) {
    console.error(chalk.red("ERROR: Missing URL to OpenAPI spec"));
    process.exit(1);
}

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
