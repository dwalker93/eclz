import type { Metadata } from "next"

import { LecturerQuestions } from "@/components/lecturer-questions"

export const metadata: Metadata = {
  title: "Lecturer Question Bank",
}

export default function LecturerQuestionsPage() {
  return <LecturerQuestions />
}
