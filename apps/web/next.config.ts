import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@aus-dash/ui"],
  outputFileTracingRoot: path.join(currentDir, "../..")
};

export default nextConfig;
