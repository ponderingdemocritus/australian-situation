import { describe, expect, test } from "vitest";
import { calculateServiceability } from "../src/domain/serviceability";

describe("calculateServiceability", () => {
  test("computes monthly repayment and burden ratio", () => {
    const result = calculateServiceability({
      loan: 500_000,
      rate: 0.06,
      termYears: 30,
      income: 180_000
    });

    expect(result.monthlyRepayment).toBeCloseTo(2997.75, 2);
    expect(result.burdenRatio).toBeCloseTo(0.1999, 4);
    expect(result.stressBand).toBe("low");
  });

  test("classifies high stress when repayment burden is elevated", () => {
    const result = calculateServiceability({
      loan: 800_000,
      rate: 0.07,
      termYears: 30,
      income: 100_000
    });

    expect(result.burdenRatio).toBeGreaterThanOrEqual(0.45);
    expect(result.stressBand).toBe("high");
  });

  test("rejects invalid inputs", () => {
    expect(() =>
      calculateServiceability({
        loan: 0,
        rate: 0.06,
        termYears: 30,
        income: 120_000
      })
    ).toThrow("loan must be greater than 0");

    expect(() =>
      calculateServiceability({
        loan: 500_000,
        rate: -1,
        termYears: 30,
        income: 120_000
      })
    ).toThrow("rate must be between 0 and 1");

    expect(() =>
      calculateServiceability({
        loan: 500_000,
        rate: 0.06,
        termYears: 0,
        income: 120_000
      })
    ).toThrow("termYears must be greater than 0");

    expect(() =>
      calculateServiceability({
        loan: 500_000,
        rate: 0.06,
        termYears: 30,
        income: 0
      })
    ).toThrow("income must be greater than 0");
  });
});
