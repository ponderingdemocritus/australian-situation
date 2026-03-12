type PublicSdkOptions = {
  baseUrl: string;
  responseStyle: "data";
  throwOnError: true;
};

const DEFAULT_API_BASE_URL = "http://localhost:3001";

export function createPublicSdkOptions(): PublicSdkOptions {
  return {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE_URL,
    responseStyle: "data",
    throwOnError: true
  };
}
