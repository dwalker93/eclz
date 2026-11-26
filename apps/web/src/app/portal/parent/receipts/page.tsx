import type { Metadata } from "next"

import { ParentReceipts } from "@/components/parent-receipts"

export const metadata: Metadata = {
  title: "Parent Receipts",
}

export default function ParentReceiptsPage() {
  return <ParentReceipts />
}
