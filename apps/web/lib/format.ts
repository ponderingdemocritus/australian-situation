const wholeNumber = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 0
});

const oneDecimal = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const twoDecimal = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatWholeNumber(value: number) {
  return wholeNumber.format(value);
}

export function formatOneDecimal(value: number) {
  return oneDecimal.format(value);
}

export function formatTwoDecimals(value: number) {
  return twoDecimal.format(value);
}

export function formatIsoDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value.slice(0, 10);
}
