import type { Metadata } from "next"

import { ParentAttendance } from "@/components/parent-attendance"

export const metadata: Metadata = {
  title: "Parent Attendance",
}

export default function ParentAttendancePage() {
  return <ParentAttendance />
}
