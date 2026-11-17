import type { Metadata } from "next"

import { LecturerDashboard } from "@/components/lecturer-dashboard"

export const metadata: Metadata = {
  title: "Lecturer Dashboard",
}

export default function LecturerDashboardPage() {
  return <LecturerDashboard />
}
