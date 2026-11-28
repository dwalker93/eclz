import type { Metadata } from "next"

import { ParentNotifications } from "@/components/parent-notifications"

export const metadata: Metadata = {
  title: "Parent Notifications",
}

export default function ParentNotificationsPage() {
  return <ParentNotifications />
}
