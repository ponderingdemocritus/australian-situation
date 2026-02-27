import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import HomePage from "../app/page";

export async function renderHomePage() {
  const page = await HomePage();
  return render(page as ReactElement);
}
