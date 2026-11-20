import type { Metadata } from "next"

import { LecturerAttendance } from "@/components/lecturer-attendance"

export const metadata: Metadata = {
  title: "Lecturer Attendance",
}

export default function LecturerAttendancePage() {
  return <LecturerAttendance />
}
