import { PortalShell } from "@/components/portal-shell"

export default function ParentPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PortalShell role="parent">{children}</PortalShell>
}
