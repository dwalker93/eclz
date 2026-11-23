import type { Metadata } from "next"

import { LecturerExams } from "@/components/lecturer-exams"

export const metadata: Metadata = {
  title: "Lecturer Exams",
}

export default function LecturerExamsPage() {
  return <LecturerExams />
}
