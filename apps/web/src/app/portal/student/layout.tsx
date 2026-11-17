import { PortalShell } from "@/components/portal-shell"

export default function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PortalShell>{children}</PortalShell>
}
