import { Card, CardContent } from "@/components/ui/card"
import { cn, formatCompact, formatCurrency } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

export interface StatCardGradient {
  from: string
  to: string
  ring: string
  accent: string
}

interface StatCardProps {
  title: string
  value: string
  numericValue?: number   // when provided, shows compact big + full small in gradient mode
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  className?: string
  gradient?: StatCardGradient
}

export function StatCard({ title, value, numericValue, subtitle, icon: Icon, trend, className, gradient }: StatCardProps) {
  if (gradient) {
    const displayValue = numericValue !== undefined ? formatCompact(numericValue) : value
    const fullValue    = numericValue !== undefined ? formatCurrency(numericValue) : null

    return (
      <div className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 sm:p-4 ring-1",
        gradient.from, gradient.to, gradient.ring,
        className,
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium">{title}</p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums truncate mt-0.5">{displayValue}</p>
            {fullValue && (
              <p className="text-[10px] sm:text-xs text-muted-foreground/70 tabular-nums mt-0.5 truncate">{fullValue}</p>
            )}
            {subtitle && !fullValue && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
            {subtitle && fullValue && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
            {trend && (
              <p className={cn("text-[10px] sm:text-xs font-medium mt-0.5", trend.value >= 0 ? "text-emerald-500" : "text-red-500")}>
                {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div className={cn("rounded-full p-1.5 sm:p-2 bg-background/40 shrink-0", gradient.accent)}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend && (
              <p className={cn("text-xs font-medium", trend.value >= 0 ? "text-green-500" : "text-red-500")}>
                {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div className="rounded-full bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
