import { render } from "@testing-library/react";
import type { ReactElement } from "react";

export async function renderRoute(route: Promise<ReactElement> | ReactElement) {
  const page = await route;
  return render(page);
}
