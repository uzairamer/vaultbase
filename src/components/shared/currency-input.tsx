"use client"

import { forwardRef, type InputHTMLAttributes } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  currency?: string
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ currency = "PKR", className, ...props }, ref) => {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {currency}
        </span>
        <Input
          ref={ref}
          type="number"
          step="0.01"
          min="0"
          className={cn("pl-12", className)}
          {...props}
        />
      </div>
    )
  }
)
CurrencyInput.displayName = "CurrencyInput"
