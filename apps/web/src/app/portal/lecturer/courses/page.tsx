import type { Metadata } from "next"

import { LecturerCourses } from "@/components/lecturer-courses"

export const metadata: Metadata = {
  title: "My Courses",
}

export default function LecturerCoursesPage() {
  return <LecturerCourses />
}
