export const APP_NAME = "Vaultbase"

export const WALLET_TYPES = [
  { value: "bank", label: "Bank Account" },
  { value: "cash", label: "Cash" },
  { value: "digital_wallet", label: "Digital Wallet" },
  { value: "other", label: "Other" },
] as const

export const TRANSACTION_TYPES = [
  { value: "inflow", label: "Inflow" },
  { value: "outflow", label: "Outflow" },
] as const

export const INFLOW_SUBTYPES = [
  { value: "earned_income", label: "Earned Income" },
  { value: "passive_income", label: "Passive / Investment Income" },
  { value: "receivable_collection", label: "Receivable Collection" },
  { value: "other_inflow", label: "Other (Gift, Refund, Claim)" },
] as const

export const OUTFLOW_SUBTYPES = [
  { value: "fixed_expense", label: "Fixed Expense" },
  { value: "variable_expense", label: "Variable Expense" },
  { value: "lending", label: "Lending / Receivable Created" },
  { value: "debt_repayment", label: "Debt Repayment" },
  { value: "savings_investment", label: "Savings & Investments" },
] as const

export const INVESTMENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
  { value: "matured", label: "Matured" },
] as const

export const COMMODITY_TYPES = [
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "oil", label: "Oil" },
  { value: "other", label: "Other" },
] as const

export const COMMODITY_UNITS = [
  { value: "oz", label: "Ounce (oz)" },
  { value: "gram", label: "Gram (g)" },
  { value: "tola", label: "Tola" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "barrel", label: "Barrel" },
] as const

export const SIDE_INVESTMENT_TYPES = [
  { value: "crypto", label: "Cryptocurrency" },
  { value: "lending", label: "Lending" },
  { value: "business", label: "Business" },
  { value: "other", label: "Other" },
] as const

export const DEBT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "settled", label: "Settled" },
] as const

export const INSTALLMENT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
] as const
