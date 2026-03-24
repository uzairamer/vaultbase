import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Topbar } from "@/components/layout/topbar"
import { NavigationProgress } from "@/components/layout/navigation-progress"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <NavigationProgress />
      <AppSidebar />
      <SidebarInset>
        <Topbar />
        <main className="flex-1 p-6 overflow-x-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
