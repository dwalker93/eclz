import type { Metadata } from "next"

import { ParentNotices } from "@/components/parent-notices"

export const metadata: Metadata = {
  title: "Parent Notices",
}

export default function ParentNoticesPage() {
  return <ParentNotices />
}
