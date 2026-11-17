import type { Metadata } from "next"

import { StudentExams } from "@/components/student-exams"

export const metadata: Metadata = {
  title: "Student Exams and results",
}

export default function StudentExamsPage() {
  return <StudentExams />
}
