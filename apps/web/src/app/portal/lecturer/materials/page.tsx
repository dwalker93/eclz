import type { Metadata } from "next"

import { LecturerMaterials } from "@/components/lecturer-materials"

export const metadata: Metadata = {
  title: "Lecturer Learning Materials",
}

export default function LecturerMaterialsPage() {
  return <LecturerMaterials />
}
