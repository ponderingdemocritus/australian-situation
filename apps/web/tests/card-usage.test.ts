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
    description: "deep shadcn card imports",
    pattern: /@aus-dash\/ui\/components\/ui\/card/
  },
  {
    description: "custom className overrides on shadcn cards",
    pattern: /<Card\b[^>]*\bclassName=/
  },
  {
    description: "ad hoc slate card surfaces",
    pattern: /rounded-2xl border border-slate-200 bg-(?:white\/80|slate-50\/80)/
  },
  {
    description: "ad hoc dark card surfaces",
    pattern: /rounded-2xl border border-white\/10 bg-white\/5/
  },
  {
    description: "ad hoc generic dashboard card surfaces",
    pattern: /rounded-xl border bg-card/
  },
  {
    description: "ad hoc muted row card surfaces",
    pattern: /rounded-xl border border-slate-200 bg-slate-50\/80/
  },
  {
    description: "ad hoc white card surfaces",
    pattern: /rounded-xl border border-slate-200 bg-white/
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

describe("card usage", () => {
  test("app code relies on shared shadcn card primitives without custom card styling", () => {
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
