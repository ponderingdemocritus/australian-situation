export type ServiceabilityInput = {
  loan: number;
  rate: number;
  termYears: number;
  income: number;
};

export type StressBand = "low" | "medium" | "high";

export type ServiceabilityResult = {
  monthlyRepayment: number;
  burdenRatio: number;
  stressBand: StressBand;
};

function validateInput(input: ServiceabilityInput): void {
  if (input.loan <= 0) {
    throw new Error("loan must be greater than 0");
  }

  if (input.rate < 0 || input.rate > 1) {
    throw new Error("rate must be between 0 and 1");
  }

  if (input.termYears <= 0) {
    throw new Error("termYears must be greater than 0");
  }

  if (input.income <= 0) {
    throw new Error("income must be greater than 0");
  }
}

function toStressBand(burdenRatio: number): StressBand {
  if (burdenRatio >= 0.45) {
    return "high";
  }

  if (burdenRatio >= 0.3) {
    return "medium";
  }

  return "low";
}

export function calculateServiceability(
  input: ServiceabilityInput
): ServiceabilityResult {
  validateInput(input);

  const monthlyRate = input.rate / 12;
  const totalMonths = input.termYears * 12;
  const factor = Math.pow(1 + monthlyRate, totalMonths);
  const monthlyRepayment =
    (input.loan * monthlyRate * factor) / (factor - 1);
  const monthlyIncome = input.income / 12;
  const burdenRatio = monthlyRepayment / monthlyIncome;

  return {
    monthlyRepayment,
    burdenRatio,
    stressBand: toStressBand(burdenRatio)
  };
}
