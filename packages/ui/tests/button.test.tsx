import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Button } from "../src";

describe("Button", () => {
  test("defaults button type to prevent implicit form submission", () => {
    const markup = renderToStaticMarkup(<Button>Save</Button>);
    expect(markup).toContain('type="button"');
  });

  test("respects explicit button type", () => {
    const markup = renderToStaticMarkup(<Button type="submit">Submit</Button>);
    expect(markup).toContain('type="submit"');
  });
});
