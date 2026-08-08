"use client"

import { use } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { BookOpen, Package, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { title: "Ledger",    icon: BookOpen, segment: "ledger" },
  { title: "Inventory", icon: Package,  segment: "inventory" },
  { title: "Insights",  icon: BarChart2, segment: "insights" },
]

export default function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = use(params)
  const pathname = usePathname()

  return (
    <div className="relative">
      {/* Page content — add bottom padding on mobile so FAB/tab bar don't overlap */}
      <div className="pb-20 sm:pb-0">
        {children}
      </div>

      {/* ── Native bottom tab bar (mobile only) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t bg-background/95 backdrop-blur-md">
        <div className="flex items-stretch h-16">
          {TABS.map((tab) => {
            const href = `/businesses/${businessId}/${tab.segment}`
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={tab.segment}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground/70 hover:text-muted-foreground"
                )}
              >
                <tab.icon
                  className="h-5 w-5 transition-transform"
                  strokeWidth={isActive ? 2.5 : 1.5}
                  style={{ transform: isActive ? "scale(1.1)" : "scale(1)" }}
                />
                <span className={cn(
                  "text-[10px] font-medium tracking-wide",
                  isActive && "text-primary"
                )}>
                  {tab.title}
                </span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop tab bar (shown above content on sm+) */}
      <div className="hidden sm:flex border-b mb-6 -mt-6 -mx-6 px-6 bg-background sticky top-0 z-30">
        {TABS.map((tab) => {
          const href = `/businesses/${businessId}/${tab.segment}`
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={tab.segment}
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
              )}
            >
              <tab.icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 1.5} />
              {tab.title}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
