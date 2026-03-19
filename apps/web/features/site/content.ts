export const dashboardNavItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/energy", label: "Energy" },
  { href: "/dashboard/housing", label: "Housing" },
  { href: "/dashboard/sources", label: "Sources" },
  { href: "/dashboard/prices", label: "Prices" },
  { href: "/dashboard/series", label: "Series" },
  { href: "/dashboard/methodology", label: "Methodology" }
] as const;

export const dashboardPreviewCards = [
  {
    title: "Energy",
    description: "Wholesale, retail, comparisons, and household exposure."
  },
  {
    title: "Housing",
    description: "Market pressure, lending context, and affordability signals."
  },
  {
    title: "Sources",
    description: "Freshness, cadence, provenance, and methodology context."
  },
  {
    title: "Prices",
    description: "Major goods and AI-deflation views when credentials are enabled."
  }
] as const;
