import type { Metadata } from "next"

import { StudentMessages } from "@/components/student-messages"

export const metadata: Metadata = {
  title: "Student Messages",
}

export default function StudentMessagesPage() {
  return <StudentMessages />
}
