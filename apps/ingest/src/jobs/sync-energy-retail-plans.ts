import {
  type AerRetailPlan,
  selectResidentialPlans
} from "../mappers/aer-prd";

export type SyncEnergyRetailPlansResult = {
  job: "sync-energy-retail-plans";
  status: "ok";
  totalPlansSeen: number;
  residentialPlansIngested: number;
  aggregates: {
    annualBillAudMean: number;
    annualBillAudMedian: number;
  };
  syncedAt: string;
};

const PLAN_FIXTURE: AerRetailPlan[] = [
  {
    planId: "nsw-resi-1",
    regionCode: "NSW",
    customerType: "residential",
    annualBillAud: 1910
  },
  {
    planId: "nsw-resi-2",
    regionCode: "NSW",
    customerType: "residential",
    annualBillAud: 2010
  },
  {
    planId: "qld-smb-1",
    regionCode: "QLD",
    customerType: "small_business",
    annualBillAud: 2380
  },
  {
    planId: "vic-resi-1",
    regionCode: "VIC",
    customerType: "residential",
    annualBillAud: 1825
  }
];

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

export async function syncEnergyRetailPlans(): Promise<SyncEnergyRetailPlansResult> {
  const residentialPlans = selectResidentialPlans(PLAN_FIXTURE);
  const annualBills = residentialPlans.map((plan) => plan.annualBillAud);

  return {
    job: "sync-energy-retail-plans",
    status: "ok",
    totalPlansSeen: PLAN_FIXTURE.length,
    residentialPlansIngested: residentialPlans.length,
    aggregates: {
      annualBillAudMean: mean(annualBills),
      annualBillAudMedian: median(annualBills)
    },
    syncedAt: new Date().toISOString()
  };
}
