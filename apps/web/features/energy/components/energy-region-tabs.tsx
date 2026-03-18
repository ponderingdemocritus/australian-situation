"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@aus-dash/ui";
import {
  ENERGY_DASHBOARD_REGIONS,
  type EnergyDashboardRegion
} from "../../../lib/queries/energy-dashboard";

type EnergyRegionTabsProps = {
  selectedRegion: EnergyDashboardRegion;
};

export function EnergyRegionTabs({
  selectedRegion
}: EnergyRegionTabsProps) {
  return (
    <Tabs value={selectedRegion}>
      <TabsList variant="line" className="w-full justify-start">
        {ENERGY_DASHBOARD_REGIONS.map((region) => (
          <TabsTrigger key={region} asChild value={region}>
            <Link href={`/dashboard/energy?region=${region}`}>{region}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
