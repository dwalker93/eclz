import type { Metadata } from "next"

import { ParentExams } from "@/components/parent-exams"

export const metadata: Metadata = {
  title: "Parent Exams & Results",
}

export default function ParentExamsPage() {
  return <ParentExams />
}
