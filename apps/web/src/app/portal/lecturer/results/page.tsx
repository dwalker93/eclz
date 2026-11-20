import type { Metadata } from "next"

import { LecturerResults } from "@/components/lecturer-results"

export const metadata: Metadata = {
  title: "Lecturer Results",
}

export default function LecturerResultsPage() {
  return <LecturerResults />
}
