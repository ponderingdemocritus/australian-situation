import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, test } from "vitest";

type EnergyMetricCardProps = {
  title: string;
  value: string;
  isModeled: boolean;
};

async function loadEnergyMetricCard() {
  try {
    const modulePath = "../features/energy/components/energy-metric-card";
    const moduleExports = await import(/* @vite-ignore */ modulePath);
    return moduleExports.EnergyMetricCard as ComponentType<EnergyMetricCardProps>;
  } catch {
    return null;
  }
}

describe("EnergyMetricCard modeled badge guard", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders 'Modeled estimate' only when isModeled is true", async () => {
    const EnergyMetricCard = await loadEnergyMetricCard();

    expect(EnergyMetricCard).toBeTypeOf("function");
    if (!EnergyMetricCard) {
      return;
    }

    const { rerender } = render(
      <EnergyMetricCard
        title="Live wholesale index"
        value="11.8 c/kWh"
        isModeled={false}
      />
    );
    expect(screen.queryByText("Modeled estimate")).toBeNull();

    rerender(
      <EnergyMetricCard
        title="Estimated household electricity cost"
        value="$204"
        isModeled
      />
    );
    expect(screen.getByText("Modeled estimate")).toBeDefined();
  });
});
