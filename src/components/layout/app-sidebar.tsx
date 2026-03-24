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
  Eye,
  Calculator,
  History,
  Settings,
  KeyRound,
  BookOpen,
  Banknote,
  GitBranch,
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
  useSidebar,
} from "@/components/ui/sidebar"

type NavLeaf = { title: string; href: string; icon: React.ElementType }
type NavChild = NavLeaf & { children?: NavLeaf[] }
type NavItem = NavLeaf & { children?: NavChild[] }

const navItems: NavItem[] = [
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
      {
        title: "Stocks",
        href: "/insights/stocks",
        icon: LineChart,
        children: [
          { title: "Company Profile", href: "/insights/stocks/company-profile", icon: BookOpen },
          { title: "Heatmap", href: "/insights/stocks/heatmap", icon: BarChart },
          { title: "Historical", href: "/insights/stocks/historical", icon: History },
          { title: "Overview", href: "/insights/stocks", icon: BarChart3 },
          { title: "SIP Simulator", href: "/insights/stocks/sip", icon: Calculator },
          { title: "Watchlist", href: "/insights/stocks/watchlist", icon: Eye },
        ],
      },
      { title: "Commodities", href: "/insights/commodities", icon: BarChart },
      { title: "Expenses", href: "/insights/expenses", icon: PieChart },
    ],
  },
  {
    title: "Incomes",
    href: "/incomes/breakdown",
    icon: Banknote,
    children: [
      { title: "Breakdown", href: "/incomes/breakdown", icon: GitBranch },
    ],
  },
  {
    title: "Settings",
    href: "/settings/configs",
    icon: Settings,
    children: [
      { title: "Configs", href: "/settings/configs", icon: KeyRound },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

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
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
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
                            isActive={
                              child.children
                                ? pathname.startsWith(child.href)
                                : pathname === child.href
                            }
                          >
                            <Link href={child.href} onClick={() => setOpenMobile(false)}>
                              <child.icon className="h-3.5 w-3.5" />
                              <span>{child.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                          {child.children && (
                            <SidebarMenuSub>
                              {child.children.map((grandchild) => (
                                <SidebarMenuSubItem key={grandchild.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={pathname === grandchild.href}
                                  >
                                    <Link href={grandchild.href} onClick={() => setOpenMobile(false)}>
                                      <grandchild.icon className="h-3 w-3" />
                                      <span>{grandchild.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          )}
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
