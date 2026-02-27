"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  TrendingUp,
  Building2,
  BarChart3,
  Gem,
  Briefcase,
  Receipt,
  Wallet,
  Users,
  HandCoins,
  Upload,
  Tag,
  PieChart,
  LineChart,
  BarChart,
  FileBarChart2,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Investments",
    href: "/investments",
    icon: TrendingUp,
    children: [
      { title: "Real Estate", href: "/investments/real-estate", icon: Building2 },
      { title: "Stocks", href: "/investments/stocks", icon: BarChart3 },
      { title: "Commodities", href: "/investments/commodities", icon: Gem },
      { title: "Other", href: "/investments/other", icon: Briefcase },
    ],
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: Receipt,
    children: [
      { title: "Wallets", href: "/expenses/wallets", icon: Wallet },
      { title: "Receivables", href: "/expenses/receivables", icon: Users },
      { title: "Liabilities", href: "/expenses/liabilities", icon: HandCoins },
      { title: "Import", href: "/expenses/import", icon: Upload },
      { title: "Categories", href: "/expenses/categories", icon: Tag },
      { title: "Financial Position", href: "/expenses/report", icon: FileBarChart2 },
    ],
  },
  {
    title: "Insights",
    href: "/insights",
    icon: PieChart,
    children: [
      { title: "Stocks", href: "/insights/stocks", icon: LineChart },
      { title: "Commodities", href: "/insights/commodities", icon: BarChart },
      { title: "Expenses", href: "/insights/expenses", icon: PieChart },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            V
          </div>
          <span className="text-lg font-bold">Vaultbase</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.children && (
                    <SidebarMenuSub>
                      {item.children.map((child) => (
                        <SidebarMenuSubItem key={child.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === child.href}
                          >
                            <Link href={child.href}>
                              <child.icon className="h-3.5 w-3.5" />
                              <span>{child.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
