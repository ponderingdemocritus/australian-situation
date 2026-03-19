import { DEFAULT_SDK_BASE_URL, type SdkConfig } from "@aus-dash/sdk";

type ParsedArgs = {
  flags: Record<string, string | boolean>;
  positionals: string[];
};

export type CliConfig = {
  baseUrl: string;
  flags: Record<string, string | boolean>;
  password?: string;
  positionals: string[];
  userAgent: string;
  username?: string;
};

function parseArgv(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      positionals.push(token ?? "");
      continue;
    }

    const name = token.slice(2);
    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith("--")) {
      flags[name] = true;
      continue;
    }

    flags[name] = nextToken;
    index += 1;
  }

  return {
    flags,
    positionals
  };
}

export function resolveCliConfig(argv: string[], env: NodeJS.ProcessEnv = process.env): CliConfig {
  const parsed = parseArgv(argv);

  return {
    baseUrl:
      (typeof parsed.flags["base-url"] === "string" ? parsed.flags["base-url"] : undefined) ??
      env.AUS_DASH_BASE_URL ??
      env.AUS_DASH_API_BASE_URL ??
      DEFAULT_SDK_BASE_URL,
    flags: parsed.flags,
    password:
      (typeof parsed.flags.password === "string" ? parsed.flags.password : undefined) ??
      env.AUS_DASH_PASSWORD,
    positionals: parsed.positionals,
    userAgent: env.AUS_DASH_CLI_USER_AGENT ?? "@aus-dash/cli",
    username:
      (typeof parsed.flags.username === "string" ? parsed.flags.username : undefined) ??
      env.AUS_DASH_USERNAME
  };
}

export function sdkConfigFromCli(config: CliConfig): SdkConfig {
  return {
    auth:
      config.username && config.password
        ? {
            password: config.password,
            username: config.username
          }
        : null,
    baseUrl: config.baseUrl,
    userAgent: config.userAgent
  };
}
