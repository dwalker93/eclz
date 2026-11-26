import type { Metadata } from "next"

import { ParentTimetable } from "@/components/parent-timetable"

export const metadata: Metadata = {
  title: "Parent Timetable",
}

export default function ParentTimetablePage() {
  return <ParentTimetable />
}
