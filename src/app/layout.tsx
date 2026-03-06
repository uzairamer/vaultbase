import type { Metadata } from "next"
import { Martel_Sans } from "next/font/google"
import "./globals.css"
import { AuthSessionProvider } from "@/providers/session-provider"
import { QueryProvider } from "@/providers/query-provider"
import { ThemeProvider } from "@/providers/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"

const martelSans = Martel_Sans({ subsets: ["latin"], weight: ["200", "300", "400", "600", "700", "800", "900"] })

export const metadata: Metadata = {
  title: "Vaultbase — Personal Wealth Management",
  description: "Track investments, expenses, and net worth all in one place.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={martelSans.className}>
        <AuthSessionProvider>
          <QueryProvider>
            <ThemeProvider>
              <TooltipProvider>
                {children}
                <Toaster richColors position="top-right" expand visibleToasts={9} duration={10000} />
              </TooltipProvider>
            </ThemeProvider>
          </QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  )
}
