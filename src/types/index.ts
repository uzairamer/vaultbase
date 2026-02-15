export type WalletType = "bank" | "cash" | "digital_wallet" | "other"
export type TransactionType = "inflow" | "outflow"
export type TransactionSubType =
  | "earned_income" | "passive_income" | "receivable_collection" | "other_inflow"
  | "fixed_expense" | "variable_expense" | "lending" | "debt_repayment" | "savings_investment"
export type CategoryType = "income" | "expense"
export type DebtStatus = "pending" | "partial" | "settled"
export type InstallmentStatus = "pending" | "paid" | "overdue"
export type InvestmentStatus = "active" | "sold" | "completed" | "closed" | "matured"
export type TradeType = "buy" | "sell"
export type CommodityType = "gold" | "silver" | "oil" | "other"
export type SideInvestmentType = "crypto" | "lending" | "business" | "other"

export interface NetWorthData {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  walletBalance: number
  realEstateValue: number
  stocksValue: number
  commoditiesValue: number
  sideInvestmentsValue: number
  receivablesTotal: number
  liabilitiesTotal: number
}
