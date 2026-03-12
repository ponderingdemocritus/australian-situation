import { createPublicSdkOptions } from "./public";

type ProtectedSdkOptions = ReturnType<typeof createPublicSdkOptions> & {
  headers: {
    authorization: string;
  };
};

export function createProtectedSdkOptions(): ProtectedSdkOptions | null {
  const username = process.env.AUS_DASH_WEB_USERNAME;
  const password = process.env.AUS_DASH_WEB_PASSWORD;

  if (!username || !password) {
    return null;
  }

  return {
    ...createPublicSdkOptions(),
    headers: {
      authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
    }
  };
}
