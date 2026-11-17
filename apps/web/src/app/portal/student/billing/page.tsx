import type { Metadata } from "next"

import { StudentBilling } from "@/components/student-billing"

export const metadata: Metadata = {
  title: "Student Invoices and payments",
}

export default function StudentBillingPage() {
  return <StudentBilling />
}
