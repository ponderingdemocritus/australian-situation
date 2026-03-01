export type ComparableObservation = {
  countryCode: string;
  date: string;
  value: number;
  methodologyVersion: string | null;
};

export type RankedComparableObservation = ComparableObservation & {
  rank: number;
};

export function rankComparableObservations(
  rows: ComparableObservation[]
): RankedComparableObservation[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.value !== a.value) {
      return b.value - a.value;
    }
    return a.countryCode.localeCompare(b.countryCode);
  });

  let previousValue: number | null = null;
  let previousRank = 0;

  return sorted.map((row, index) => {
    const rank =
      previousValue !== null && row.value === previousValue ? previousRank : index + 1;
    previousValue = row.value;
    previousRank = rank;
    return {
      ...row,
      rank
    };
  });
}

export function computePercentile(rank: number, count: number): number {
  if (count <= 1) {
    return 100;
  }

  const percentile = ((count - rank) / (count - 1)) * 100;
  return Math.round(percentile * 100) / 100;
}

export function computePeerComparisons(
  countryCode: string,
  rows: ComparableObservation[],
  peers: string[]
) {
  const primaryRow = rows.find((row) => row.countryCode === countryCode);
  if (!primaryRow) {
    return [];
  }

  return peers
    .map((peerCountryCode) => {
      const peerRow = rows.find((row) => row.countryCode === peerCountryCode);
      if (!peerRow) {
        return null;
      }

      const gap = primaryRow.value - peerRow.value;
      const gapPct = peerRow.value === 0 ? 0 : (gap / peerRow.value) * 100;

      return {
        peerCountryCode,
        peerValue: peerRow.value,
        gap,
        gapPct: Math.round(gapPct * 100) / 100
      };
    })
    .filter((comparison) => comparison !== null);
}
