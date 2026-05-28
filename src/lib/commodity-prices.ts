// Weight conversion constants (user-specified)
export const TOLA_TO_GRAMS = 11.664
export const OUNCE_TO_GRAMS = 31.103

// Given a price per tola, return the price per unit for the given commodity unit.
export function pricePerUnit(pricePerTola: number, unit: string): number {
  const perGram = pricePerTola / TOLA_TO_GRAMS
  switch (unit.toLowerCase()) {
    case "tola":   return pricePerTola
    case "gram":   return perGram
    case "oz":
    case "ounce":  return perGram * OUNCE_TO_GRAMS
    default:       return pricePerTola  // barrel, other — use tola price as-is
  }
}

// All derived rates from a single tola price.
export function allRates(pricePerTola: number) {
  const perGram = pricePerTola / TOLA_TO_GRAMS
  return {
    perTola:  pricePerTola,
    perGram,
    perOunce: perGram * OUNCE_TO_GRAMS,
  }
}
