import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const stylesPath = join(process.cwd(), "app/styles.css");

const forbiddenPatterns = [
  {
    description: "custom gradients",
    pattern: /radial-gradient|linear-gradient/
  },
  {
    description: "custom font stacks",
    pattern: /font-family:/
  },
  {
    description: "custom scroll behavior",
    pattern: /scroll-behavior:/
  },
  {
    description: "global box sizing overrides",
    pattern: /box-sizing:/
  },
  {
    description: "global link overrides",
    pattern: /text-decoration:\s*none|color:\s*inherit;/
  }
];

describe("styles usage", () => {
  test("global stylesheet stays limited to theme variables and base shadcn rules", () => {
    const contents = readFileSync(stylesPath, "utf8");
    const violations = forbiddenPatterns.flatMap(({ description, pattern }) =>
      pattern.test(contents) ? [description] : []
    );

    expect(violations).toEqual([]);
  });
});
