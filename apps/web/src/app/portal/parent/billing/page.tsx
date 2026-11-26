import type { Metadata } from "next"

import { ParentBilling } from "@/components/parent-billing"

export const metadata: Metadata = {
  title: "Parent Invoices and payments",
}

export default function ParentBillingPage() {
  return <ParentBilling />
}
