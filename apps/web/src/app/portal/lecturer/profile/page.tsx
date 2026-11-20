import type { Metadata } from "next"

import { LecturerProfile } from "@/components/lecturer-profile"

export const metadata: Metadata = {
  title: "Lecturer My Profile",
}

export default function LecturerProfilePage() {
  return <LecturerProfile />
}
