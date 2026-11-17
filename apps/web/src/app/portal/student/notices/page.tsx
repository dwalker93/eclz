import type { Metadata } from "next"

import { StudentNotices } from "@/components/student-notices"

export const metadata: Metadata = {
  title: "Student Notices",
}

export default function StudentNoticesPage() {
  return <StudentNotices />
}
