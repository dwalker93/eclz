import type { Metadata } from "next"

import { ParentChildren } from "@/components/parent-children"

export const metadata: Metadata = {
  title: "Parent My Children",
}

export default function ParentChildrenPage() {
  return <ParentChildren />
}
