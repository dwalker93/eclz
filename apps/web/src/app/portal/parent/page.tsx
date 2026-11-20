import type { Metadata } from "next"

import { ParentDashboard } from "@/components/parent-dashboard"

export const metadata: Metadata = {
  title: "Parent Dashboard",
}

export default function ParentDashboardPage() {
  return <ParentDashboard />
}
