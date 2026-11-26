import type { Metadata } from "next"

import { ParentCourses } from "@/components/parent-courses"

export const metadata: Metadata = {
  title: "Parent Courses",
}

export default function ParentCoursesPage() {
  return <ParentCourses />
}
