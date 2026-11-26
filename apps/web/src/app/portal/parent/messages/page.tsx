import type { Metadata } from "next"

import { ParentMessages } from "@/components/parent-messages"

export const metadata: Metadata = {
  title: "Parent Messages",
}

export default function ParentMessagesPage() {
  return <ParentMessages />
}
