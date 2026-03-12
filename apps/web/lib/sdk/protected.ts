import { createPublicSdkOptions } from "./public";

type ProtectedSdkOptions = ReturnType<typeof createPublicSdkOptions> & {
  headers: {
    authorization: string;
  };
};

export function createProtectedSdkOptions(): ProtectedSdkOptions | null {
  const publicOptions = createPublicSdkOptions();
  const username = process.env.AUS_DASH_WEB_USERNAME;
  const password = process.env.AUS_DASH_WEB_PASSWORD;
  const localFallbackEnabled =
    publicOptions.baseUrl.includes("localhost") || publicOptions.baseUrl.includes("127.0.0.1");

  const resolvedUsername = username ?? (localFallbackEnabled ? "agent" : null);
  const resolvedPassword = password ?? (localFallbackEnabled ? "buildaustralia" : null);

  if (!resolvedUsername || !resolvedPassword) {
    return null;
  }

  return {
    ...publicOptions,
    headers: {
      authorization: `Basic ${Buffer.from(`${resolvedUsername}:${resolvedPassword}`).toString("base64")}`
    }
  };
}
