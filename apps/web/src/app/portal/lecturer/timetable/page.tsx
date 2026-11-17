import type { Metadata } from "next"

import { LecturerTimetable } from "@/components/lecturer-timetable"

export const metadata: Metadata = {
  title: "Timetable & Sessions",
}

export default function LecturerTimetablePage() {
  return <LecturerTimetable />
}
