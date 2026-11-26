import { ParentChildProvider } from "@/components/parent-child-context"
import { PortalShell } from "@/components/portal-shell"

export default function ParentPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ParentChildProvider>
      <PortalShell role="parent">{children}</PortalShell>
    </ParentChildProvider>
  )
}
