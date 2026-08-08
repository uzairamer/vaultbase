export const BUSINESS_TYPES = [
  { value: "ecommerce",  label: "Ecommerce" },
  { value: "retail",     label: "Retail" },
  { value: "service",    label: "Service" },
  { value: "freelance",  label: "Freelance" },
  { value: "other",      label: "Other" },
] as const

export const PAYMENT_METHODS = [
  "Cash", "Bank Transfer", "COD", "JazzCash", "EasyPaisa", "Card", "Other",
] as const

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Operating Expense",
  "Marketing & Advertising",
  "Inventory Purchase",
  "Shipping & Courier",
  "Utilities",
  "Salaries & Wages",
  "Rent",
  "Software Subscriptions",
  "Bank Charges & Fees",
  "Taxes",
  "Refunds & Returns",
  "Owner Draw",
  "Other Expenses",
] as const

export const DEFAULT_INCOME_CATEGORIES = [
  "Sales Revenue",
  "Service Income",
  "Other Income",
] as const
