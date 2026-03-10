export const DASHBOARD_AREAS = [
  {
    id: "energy",
    label: "Energy",
    category: "Prices and utilities",
    description: "Electricity prices, bills, and the energy mix."
  },
  {
    id: "housing",
    label: "Housing",
    category: "Households and credit",
    description: "Home values, lending, and mortgage pressure."
  }
] as const;

export type DashboardAreaId = (typeof DASHBOARD_AREAS)[number]["id"];
