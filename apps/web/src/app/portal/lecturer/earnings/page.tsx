import type { Metadata } from "next"

import { LecturerEarnings } from "@/components/lecturer-earnings"

export const metadata: Metadata = {
  title: "Lecturer My Earnings",
}

export default function LecturerEarningsPage() {
  return <LecturerEarnings />
}
