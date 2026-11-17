import type { Metadata } from "next"

import { StudentAttendance } from "@/components/student-attendance"

export const metadata: Metadata = {
  title: "Student Attendance",
}

export default function StudentAttendancePage() {
  return <StudentAttendance />
}
