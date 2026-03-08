import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import type { RegionCode } from "../features/dashboard/lib/overview";
import RegionPage from "../app/[[...region]]/page";

export async function renderHomePage(region?: RegionCode) {
  const segments = region && region !== "AU" ? [region] : undefined;
  const page = await RegionPage({ params: Promise.resolve({ region: segments }) });
  return render(page as ReactElement);
}
