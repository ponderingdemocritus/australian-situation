export type RegionalRrpPoint = {
  regionCode: string;
  timestamp: string;
  rrpAudMwh: number;
  demandMwh: number;
};

export type WeightingBasis = "demand_weighted";

export type AuWeightedWholesaleResult = {
  weighting: WeightingBasis;
  audMwh: number;
  cKwh: number;
};

type ComputeOptions = {
  weighting: WeightingBasis;
};

export function computeAuWeightedWholesaleRrp(
  points: RegionalRrpPoint[],
  options: ComputeOptions
): AuWeightedWholesaleResult {
  if (points.length === 0) {
    throw new Error("at least one point is required");
  }

  const totalDemandMwh = points.reduce((sum, point) => sum + point.demandMwh, 0);
  if (totalDemandMwh <= 0) {
    throw new Error("total demand must be greater than 0");
  }

  const weightedAudMwh =
    points.reduce((sum, point) => sum + point.rrpAudMwh * point.demandMwh, 0) /
    totalDemandMwh;

  return {
    weighting: options.weighting,
    audMwh: weightedAudMwh,
    cKwh: weightedAudMwh / 10
  };
}
