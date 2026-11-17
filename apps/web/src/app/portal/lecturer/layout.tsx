import { PortalShell } from "@/components/portal-shell"

export default function LecturerPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PortalShell role="lecturer">{children}</PortalShell>
}
