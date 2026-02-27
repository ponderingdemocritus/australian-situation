export type AerRetailPlan = {
  planId: string;
  regionCode: string;
  customerType: string;
  annualBillAud: number;
};

export function selectResidentialPlans<T extends AerRetailPlan>(
  plans: T[]
): T[] {
  return plans.filter((plan) => plan.customerType === "residential");
}
