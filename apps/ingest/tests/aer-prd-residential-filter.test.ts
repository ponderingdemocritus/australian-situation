import { describe, expect, test } from "vitest";

type RetailPlan = {
  planId: string;
  regionCode: string;
  customerType: "residential" | "small_business";
  annualBillAud: number;
};

const PLAN_FIXTURE: RetailPlan[] = [
  {
    planId: "nsw-resi-1",
    regionCode: "NSW",
    customerType: "residential",
    annualBillAud: 1910
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

async function loadResidentialFilter() {
  try {
    return await import("../src/mappers/aer-prd");
  } catch {
    return null;
  }
}

describe("selectResidentialPlans", () => {
  test("filters out non-residential plans", async () => {
    const moduleExports = await loadResidentialFilter();
    const selectResidentialPlans = moduleExports?.selectResidentialPlans;

    expect(typeof selectResidentialPlans).toBe("function");
    if (typeof selectResidentialPlans !== "function") {
      return;
    }

    const filtered = selectResidentialPlans(PLAN_FIXTURE);
    expect(filtered.map((plan: RetailPlan) => plan.planId)).toEqual([
      "nsw-resi-1",
      "vic-resi-1"
    ]);
    expect(
      filtered.every(
        (plan: RetailPlan) => plan.customerType === "residential"
      )
    ).toBe(true);
  });
});
