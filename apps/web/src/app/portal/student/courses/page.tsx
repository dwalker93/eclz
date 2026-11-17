import type { Metadata } from "next"

import { StudentCourses } from "@/components/student-courses"

export const metadata: Metadata = {
  title: "Student My Courses",
}

export default function StudentCoursesPage() {
  return <StudentCourses />
}
