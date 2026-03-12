import {
  configureSdk,
  getApiEnergyLiveWholesale,
  getApiEnergyOverview,
  getApiEnergyRetailAverage,
  getApiHealth,
  getApiMetadataFreshness,
  getApiMetadataSources,
  getApiSeriesById
} from "@aus-dash/sdk";
import { resolveCliConfig, sdkConfigFromCli } from "./config";

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function flagValue(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function writeJson(value: JsonValue) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function writeError(message: string) {
  process.stderr.write(`${message}\n`);
}

function unknownCommandError(positionals: string[]) {
  const command = positionals.join(" ").trim() || "(none)";
  return new Error(`Unknown command: ${command}`);
}

async function execute(positionals: string[], flags: Record<string, string | boolean>) {
  const [group, action, third] = positionals;

  if (group === "health") {
    return await getApiHealth({ responseStyle: "data", throwOnError: true });
  }

  if (group === "metadata" && action === "freshness") {
    return await getApiMetadataFreshness({ responseStyle: "data", throwOnError: true });
  }

  if (group === "metadata" && action === "sources") {
    return await getApiMetadataSources({ responseStyle: "data", throwOnError: true });
  }

  if (group === "energy" && action === "overview") {
    return await getApiEnergyOverview({
      query: {
        region: flagValue(flags, "region")
      },
      responseStyle: "data",
      throwOnError: true
    });
  }

  if (group === "energy" && action === "retail-average") {
    return await getApiEnergyRetailAverage({
      query: {
        customer_type: flagValue(flags, "customer-type"),
        region: flagValue(flags, "region")
      },
      responseStyle: "data",
      throwOnError: true
    });
  }

  if (group === "energy" && action === "live-wholesale") {
    return await getApiEnergyLiveWholesale({
      query: {
        region: flagValue(flags, "region"),
        window: flagValue(flags, "window")
      },
      responseStyle: "data",
      throwOnError: true
    });
  }

  if (group === "series" && action === "get" && third) {
    return await getApiSeriesById({
      path: {
        id: third
      },
      query: {
        from: flagValue(flags, "from"),
        region: flagValue(flags, "region"),
        to: flagValue(flags, "to")
      },
      responseStyle: "data",
      throwOnError: true
    });
  }

  throw unknownCommandError(positionals);
}

export async function run(argv: string[], env: NodeJS.ProcessEnv = process.env) {
  const config = resolveCliConfig(argv, env);
  configureSdk(sdkConfigFromCli(config));
  const payload = (await execute(config.positionals, config.flags)) as JsonValue;
  writeJson(payload);
}

export async function main(argv = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env) {
  try {
    await run(argv, env);
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CLI error";
    writeError(message);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
