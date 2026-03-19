import { getApiV1MetadataMethodology } from "@aus-dash/sdk";
import { createPublicSdkOptions } from "../sdk/public";
import { unwrapSdkData } from "../sdk/unwrap";

export type MethodologyDashboardModel = {
  hero: {
    summary: string;
    title: string;
  };
  metric: {
    description: string;
    dimensions: string[];
    metric: string;
    version: string;
  };
};

export async function getMethodologyDashboardData(
  metric = "energy.compare.retail"
): Promise<MethodologyDashboardModel> {
  const response = await getApiV1MetadataMethodology({
    ...createPublicSdkOptions(),
    query: { metric }
  });
  const data = unwrapSdkData(response);

  return {
    hero: {
      title: "Methodology",
      summary: "Definitions and dimensional requirements for public dashboard metrics."
    },
    metric: {
      description: data.description,
      dimensions: data.requiredDimensions,
      metric: data.metric,
      version: data.methodologyVersion
    }
  };
}
