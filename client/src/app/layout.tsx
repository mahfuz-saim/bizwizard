import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { StoreProvider } from "@/lib/store"
import { TooltipProvider } from "@/components/ui/tooltip"

export const metadata: Metadata = {
  title: "BizWizard · Inventory & Sales",
  description: "Modern inventory and sales management web app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="light" storageKey="bizwizard-ui-theme">
          <TooltipProvider delayDuration={200}>
            <StoreProvider>{children}</StoreProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
