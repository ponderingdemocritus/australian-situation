import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";

export type CliResult = {
  status: number | null;
  stderr: string;
  stdout: string;
};

export type StartedServer = {
  stop: () => void;
  url: string;
};

const packageRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..", "..");

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();

    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not resolve a free TCP port"));
        return;
      }

      const { port } = address;
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

export async function startServer(): Promise<StartedServer> {
  const port = await getAvailablePort();
  const child: ChildProcess = spawn("cargo", ["run", "-p", "aus-api"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      API_PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  // Wait for the server to be ready by polling the health endpoint
  const url = `http://127.0.0.1:${port}`;
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) break;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    stop: () => child.kill(),
    url
  };
}

export function runCli(
  baseUrl: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["src/index.ts", "--base-url", baseUrl, ...args], {
      cwd: packageRoot,
      env: {
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stderr, stdout });
    });
  });
}
