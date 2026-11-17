import type { Metadata } from "next"

import { StudentMaterials } from "@/components/student-materials"

export const metadata: Metadata = {
  title: "Student Learning Materials",
}

export default function StudentMaterialsPage() {
  return <StudentMaterials />
}
