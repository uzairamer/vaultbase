"use client"

import { useEffect, useRef, useCallback } from "react"
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
  Scale,
  Store,
  BookOpen as LedgerIcon,
  Package,
  BarChart2,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
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
    title: "Businesses",
    href: "/businesses",
    icon: Store,
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
    title: "Cash Flow",
    href: "/expenses",
    icon: Receipt,
    children: [
      { title: "Wallets", href: "/expenses/wallets", icon: Wallet },
      { title: "Receivables", href: "/expenses/receivables", icon: Users },
      { title: "Liabilities", href: "/expenses/liabilities", icon: HandCoins },
      { title: "Categories", href: "/expenses/categories", icon: Tag },
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
          { title: "Fair Value", href: "/insights/stocks/fair-value", icon: Scale },
          { title: "Heatmap", href: "/insights/stocks/heatmap", icon: BarChart },
          { title: "Historical", href: "/insights/stocks/historical", icon: History },
          { title: "Overview", href: "/insights/stocks", icon: BarChart3 },
          { title: "SIP Simulator", href: "/insights/stocks/sip", icon: Calculator },
          { title: "Watchlist", href: "/insights/stocks/watchlist", icon: Eye },
        ],
      },
      { title: "Commodities", href: "/insights/commodities", icon: BarChart },
      { title: "Expenses", href: "/insights/expenses", icon: PieChart },
      { title: "Financial Position", href: "/expenses/report", icon: FileBarChart2 },
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
      { title: "Static Prices", href: "/settings/static-prices", icon: Tag },
    ],
  },
]

const MIN_W = 180
const MAX_W = 500
const STORAGE_KEY = "vaultbase-sidebar-width"

function getWrapper(): HTMLElement | null {
  return document.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement | null
}
function applyWidth(px: number) {
  getWrapper()?.style.setProperty("--sidebar-width", `${px}px`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile, isMobile } = useSidebar()
  const { data: businesses = [] } = useQuery<Array<{ id: string; name: string; isArchived: boolean }>>({
    queryKey: ["businesses"],
    queryFn: async () => { const r = await fetch("/api/businesses"); return r.ok ? r.json() : [] },
  })
  const activeBusinesses = (businesses).filter((b) => !b.isArchived)

  // ── Resizable sidebar ────────────────────────────────────────────────────
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(272)

  // Restore saved width on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) applyWidth(Math.min(MAX_W, Math.max(MIN_W, parseFloat(saved))))
  }, [])

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isMobile) return
    e.preventDefault()
    dragging.current = true
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    startX.current = clientX
    const sidebar = document.querySelector('[data-slot="sidebar"]') as HTMLElement | null
    startW.current = sidebar ? sidebar.getBoundingClientRect().width : 272

    function move(ev: MouseEvent | TouchEvent) {
      if (!dragging.current) return
      const cx = "touches" in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX
      const newW = Math.min(MAX_W, Math.max(MIN_W, startW.current + cx - startX.current))
      applyWidth(newW)
    }
    function up() {
      dragging.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      document.removeEventListener("mousemove", move)
      document.removeEventListener("mouseup", up)
      document.removeEventListener("touchmove", move)
      document.removeEventListener("touchend", up)
      const w = getWrapper()?.style.getPropertyValue("--sidebar-width")
      if (w) localStorage.setItem(STORAGE_KEY, w.replace("px", ""))
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", move)
    document.addEventListener("mouseup", up)
    document.addEventListener("touchmove", move)
    document.addEventListener("touchend", up)
  }, [isMobile])

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
              {navItems.map((item) => {
                const isBusinesses = item.href === "/businesses"
                return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || (isBusinesses && pathname.startsWith("/businesses"))}
                    tooltip={item.title}
                  >
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>

                  {/* Static children */}
                  {item.children && (
                    <SidebarMenuSub>
                      {item.children.map((child) => (
                        <SidebarMenuSubItem key={child.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={child.children ? pathname.startsWith(child.href) : pathname === child.href}
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
                                  <SidebarMenuSubButton asChild isActive={pathname === grandchild.href}>
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

                  {/* Dynamic business children under Businesses */}
                  {isBusinesses && activeBusinesses.length > 0 && (
                    <SidebarMenuSub>
                      {activeBusinesses.map((biz) => (
                        <SidebarMenuSubItem key={biz.id}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname.startsWith(`/businesses/${biz.id}`)}
                          >
                            <Link href={`/businesses/${biz.id}/ledger`} onClick={() => setOpenMobile(false)}>
                              <Store className="h-3.5 w-3.5" />
                              <span className="truncate">{biz.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                          {pathname.startsWith(`/businesses/${biz.id}`) && (
                            <SidebarMenuSub>
                              {[
                                { title: "Ledger",    href: `/businesses/${biz.id}/ledger`,    icon: LedgerIcon },
                                { title: "Inventory", href: `/businesses/${biz.id}/inventory`, icon: Package },
                                { title: "Insights",  href: `/businesses/${biz.id}/insights`,  icon: BarChart2 },
                              ].map((sub) => (
                                <SidebarMenuSubItem key={sub.href}>
                                  <SidebarMenuSubButton asChild isActive={pathname === sub.href}>
                                    <Link href={sub.href} onClick={() => setOpenMobile(false)}>
                                      <sub.icon className="h-3 w-3" />
                                      <span>{sub.title}</span>
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
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Resize handle ── */}
      {!isMobile && (
        <div
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group z-50 hover:bg-primary/10 transition-colors"
          title="Drag to resize sidebar"
        >
          {/* Visual indicator line */}
          <div className="absolute right-0 top-0 bottom-0 w-px bg-border group-hover:bg-primary/40 transition-colors" />
        </div>
      )}
    </Sidebar>
  )
}
