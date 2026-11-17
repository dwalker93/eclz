import type { Metadata } from "next"

import { StudentProfile } from "@/components/student-profile"

export const metadata: Metadata = {
  title: "Student My Profile",
}

export default function StudentProfilePage() {
  return <StudentProfile />
}
