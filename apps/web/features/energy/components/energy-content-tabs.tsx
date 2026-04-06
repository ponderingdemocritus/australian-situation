"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aus-dash/ui";
import type { ReactNode } from "react";

type EnergyContentTabsProps = {
  marketSnapshot: ReactNode;
  international: ReactNode;
  generationMix: ReactNode;
};

export function EnergyContentTabs({
  marketSnapshot,
  international,
  generationMix,
}: EnergyContentTabsProps) {
  return (
    <Tabs defaultValue="snapshot">
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="snapshot">Market snapshot</TabsTrigger>
        <TabsTrigger value="international">International</TabsTrigger>
        <TabsTrigger value="generation">Generation mix</TabsTrigger>
      </TabsList>

      <TabsContent value="snapshot" className="space-y-6 pt-4">
        {marketSnapshot}
      </TabsContent>

      <TabsContent value="international" className="space-y-6 pt-4">
        {international}
      </TabsContent>

      <TabsContent value="generation" className="space-y-6 pt-4">
        {generationMix}
      </TabsContent>
    </Tabs>
  );
}
