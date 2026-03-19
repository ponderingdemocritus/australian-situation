import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const directoriesToScan = [
  join(root, "app"),
  join(root, "components"),
  join(root, "features")
];

const forbiddenPatterns = [
  {
    description: "deep shadcn imports from app code",
    pattern: /@aus-dash\/ui\/components\/ui\//
  },
  {
    description: "hard-coded palette tokens in app code",
    pattern: /\b(?:slate|emerald)\b|(?:black|white)\//
  },
  {
    description: "arbitrary visual values in app code",
    pattern: /\b(?:bg-\[|shadow-\[|tracking-\[|rounded-\[)/
  },
  {
    description: "styled native inputs instead of shadcn input",
    pattern: /<input\b[^>]*className=/
  },
  {
    description: "styled native selects instead of shadcn select",
    pattern: /<select\b[^>]*className=/
  }
];

function getFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return getFiles(fullPath);
    }

    return fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

describe("theme usage", () => {
  test("app code sticks to shared shadcn primitives and theme tokens", () => {
    const violations = directoriesToScan.flatMap((directory) =>
      getFiles(directory).flatMap((filePath) => {
        const contents = readFileSync(filePath, "utf8");

        return forbiddenPatterns.flatMap(({ description, pattern }) =>
          pattern.test(contents) ? [`${filePath}: ${description}`] : []
        );
      })
    );

    expect(violations).toEqual([]);
  });
});
