import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { AppSidebar } from "./app-sidebar"
import { AppHeader } from "./app-header"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full">
      <SidebarProvider className="min-w-0">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          {children}
        </div>
      </SidebarProvider>
    </div>
  )
}
