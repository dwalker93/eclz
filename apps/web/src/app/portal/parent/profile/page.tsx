import type { Metadata } from "next"

import { ParentProfile } from "@/components/parent-profile"

export const metadata: Metadata = {
  title: "Parent My Profile",
}

export default function ParentProfilePage() {
  return <ParentProfile />
}
