import { describe, expect, test } from "vitest";
import { registerEnergyRoutes, registerV1EnergyRoutes } from "../src/routes/energy-routes";
import { registerHousingRoutes } from "../src/routes/housing-routes";
import { registerMetadataRoutes, registerV1MetadataRoutes } from "../src/routes/metadata-routes";
import { registerSeriesRoutes } from "../src/routes/series-routes";

describe("route module exports", () => {
  test("provides domain route registration functions", () => {
    expect(typeof registerHousingRoutes).toBe("function");
    expect(typeof registerSeriesRoutes).toBe("function");
    expect(typeof registerEnergyRoutes).toBe("function");
    expect(typeof registerMetadataRoutes).toBe("function");
    expect(typeof registerV1EnergyRoutes).toBe("function");
    expect(typeof registerV1MetadataRoutes).toBe("function");
  });
});
