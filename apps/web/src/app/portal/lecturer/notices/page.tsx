import type { Metadata } from "next"

import { LecturerNotices } from "@/components/lecturer-notices"

export const metadata: Metadata = {
  title: "Lecturer Notices",
}

export default function LecturerNoticesPage() {
  return <LecturerNotices />
}
