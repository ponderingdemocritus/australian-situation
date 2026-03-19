import { client } from "./generated/client.gen";
import type { Config as GeneratedClientConfig } from "./generated/client/types.gen";

export const DEFAULT_SDK_BASE_URL = "http://localhost:3002";

export type SdkBasicAuth = {
  password: string;
  username: string;
};

export type SdkConfig = {
  auth?: SdkBasicAuth | null;
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit;
  timeoutMs?: number | null;
  userAgent?: string | null;
};

export type SdkPublicConfig = {
  auth: { username: string } | null;
  baseUrl: string;
  headers: Record<string, string>;
  timeoutMs: number | null;
  userAgent: string | null;
};

type SdkInternalConfig = {
  auth: SdkBasicAuth | null;
  baseUrl: string;
  fetch: typeof fetch;
  headers: Headers;
  timeoutMs: number | null;
  userAgent: string | null;
};

const runtimeDefaults = (): SdkInternalConfig => ({
  auth: null,
  baseUrl: DEFAULT_SDK_BASE_URL,
  fetch: globalThis.fetch,
  headers: new Headers(),
  timeoutMs: null,
  userAgent: null
});

let runtimeConfig = runtimeDefaults();
let requestInterceptorRegistered = false;

function normalizeConfig(config: SdkConfig = {}): SdkInternalConfig {
  return {
    auth: config.auth ?? null,
    baseUrl: config.baseUrl ?? DEFAULT_SDK_BASE_URL,
    fetch: config.fetch ?? globalThis.fetch,
    headers: new Headers(config.headers),
    timeoutMs: config.timeoutMs ?? null,
    userAgent: config.userAgent ?? null
  };
}

function publicHeaders(config: SdkInternalConfig): Headers {
  const headers = new Headers(config.headers);
  if (config.userAgent) {
    headers.set("user-agent", config.userAgent);
  }

  return headers;
}

function timeoutFetch(fetchImplementation: typeof fetch, timeoutMs: number | null): typeof fetch {
  if (!timeoutMs) {
    return fetchImplementation;
  }

  return async (input, init) => {
    const controller = new AbortController();
    const signal = init?.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetchImplementation(input, {
        ...init,
        signal
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

function authToken(config: SdkInternalConfig): string | undefined {
  if (!config.auth) {
    return undefined;
  }

  return `${config.auth.username}:${config.auth.password}`;
}

function registerRequestInterceptor() {
  if (requestInterceptorRegistered) {
    return;
  }

  client.interceptors.request.use(async (request) => {
    const headers = new Headers(request.headers);
    const defaults = publicHeaders(runtimeConfig);

    defaults.forEach((value, key) => {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    });

    return new Request(request, {
      headers
    });
  });

  requestInterceptorRegistered = true;
}

export function createSdkConfig(config: SdkConfig = {}): GeneratedClientConfig {
  const resolved = normalizeConfig(config);

  return {
    auth: () => authToken(resolved),
    baseUrl: resolved.baseUrl,
    fetch: timeoutFetch(resolved.fetch, resolved.timeoutMs)
  };
}

export function getSdkConfig(): SdkPublicConfig {
  const headers = publicHeaders(runtimeConfig);

  return {
    auth: runtimeConfig.auth ? { username: runtimeConfig.auth.username } : null,
    baseUrl: runtimeConfig.baseUrl,
    headers: Object.fromEntries(headers.entries()),
    timeoutMs: runtimeConfig.timeoutMs,
    userAgent: runtimeConfig.userAgent
  };
}

export function configureSdk(config: SdkConfig = {}): SdkPublicConfig {
  registerRequestInterceptor();
  runtimeConfig = normalizeConfig(config);
  client.setConfig(createSdkConfig(config));
  return getSdkConfig();
}

export function resetSdkConfig(): SdkPublicConfig {
  runtimeConfig = runtimeDefaults();
  client.setConfig(createSdkConfig());
  return getSdkConfig();
}

registerRequestInterceptor();
resetSdkConfig();
