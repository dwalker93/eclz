import type { Metadata } from "next"

import { LecturerMessages } from "@/components/lecturer-messages"

export const metadata: Metadata = {
  title: "Lecturer Messages",
}

export default function LecturerMessagesPage() {
  return <LecturerMessages />
}
