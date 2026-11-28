import type { Metadata } from "next"

import { AccountSettings } from "@/components/account-settings"
import { ParentChildProvider } from "@/components/parent-child-context"
import { PortalShell, type PortalRole } from "@/components/portal-shell"

export const metadata: Metadata = {
  title: "Account Settings",
}

const PORTAL_ROLES: PortalRole[] = ["student", "lecturer", "parent"]

/**
 * Account settings is shared by every role, so the menu links here with the
 * active role. The route lives outside the role folders, so it renders the
 * matching portal shell itself; each role's layout is not inherited.
 */
function resolveRole(value: string | string[] | undefined): PortalRole {
  const candidate = Array.isArray(value) ? value[0] : value

  return PORTAL_ROLES.includes(candidate as PortalRole)
    ? (candidate as PortalRole)
    : "student"
}

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const role = resolveRole((await searchParams).role)

  if (role === "parent") {
    return (
      <ParentChildProvider>
        <PortalShell role="parent">
          <AccountSettings role="parent" />
        </PortalShell>
      </ParentChildProvider>
    )
  }

  return (
    <PortalShell role={role}>
      <AccountSettings role={role} />
    </PortalShell>
  )
}
