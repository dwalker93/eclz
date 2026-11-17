/**
 * Local mock fixtures for the Content Library UI demo.
 *
 * Mirrors `content_item`, `content_branch`, `course_section` and
 * `course_content`. Content items are course/free/paid and are listed in one or
 * more branches; `placements` carry the ordered course-section placement.
 * Nothing here is persisted, and raw storage keys are never modelled — file
 * items only expose a display name.
 */

import { getCourseById, formatLkr } from "@/lib/courses-data"
import { lecturers } from "@/lib/lecturers-data"
import { MOCK_TODAY, branches } from "@/lib/students-data"

export type ContentKind = "recording" | "file" | "physical_book"
export type ContentAccessType = "course" | "free_registered" | "paid"
export type ContentStatus = "draft" | "published" | "archived"

/**
 * Paid content selling is an optional store capability. The admin shell keeps
 * the row in the mock organization modules; this flag lets the page preview
 * both the enabled and the disabled state. Course and free content are never
 * gated by it.
 */
export const CONTENT_STORE_MODULE_MOCK = {
  enabled: true,
  label: "Content store · optional module",
  hint: "Paid content is sold through invoices. Switching the module off hides paid store capabilities; course and free content stay available.",
}

export const contentKindLabels: Record<ContentKind, string> = {
  recording: "Recording",
  file: "File",
  physical_book: "Physical book",
}

export const contentAccessLabels: Record<ContentAccessType, string> = {
  course: "Course content",
  free_registered: "Free (registered)",
  paid: "Paid",
}

export const contentStatusLabels: Record<ContentStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
}

export const contentAccessHints: Record<ContentAccessType, string> = {
  course: "Included with an enrollment in a linked course.",
  free_registered: "Free to any registered student; no purchase needed.",
  paid: "Requires a paid content purchase before it is accessible.",
}

export type ContentSectionRecord = {
  id: string
  courseId: string
  title: string
  position: number
}

export type ContentPlacementRecord = {
  id: string
  courseId: string
  courseName: string
  sectionId: string | null
  sectionTitle: string | null
  position: number
}

export type ContentItemRecord = {
  id: string
  title: string
  description: string | null
  kind: ContentKind
  lecturerId: string
  lecturerName: string
  /** Recording only: external link (e.g. YouTube). */
  externalUrl: string | null
  /** File only: display name. The raw storage key is never shown. */
  fileName: string | null
  /** File only: human-readable type/size label. */
  fileLabel: string | null
  accessType: ContentAccessType
  price: number | null
  status: ContentStatus
  branchIds: string[]
  branchNames: string[]
  placements: ContentPlacementRecord[]
  createdAt: string
  /** Date-only, mirrors the schema's created_at plus local edit tracking. */
  updatedAt: string
}

const sectionSeeds: ContentSectionRecord[] = [
  {
    id: "sec-g8m-1",
    courseId: "co-g8-maths",
    title: "01 · Number skills",
    position: 0,
  },
  {
    id: "sec-g8m-2",
    courseId: "co-g8-maths",
    title: "02 · Algebra basics",
    position: 1,
  },
  {
    id: "sec-g8m-3",
    courseId: "co-g8-maths",
    title: "03 · Geometry",
    position: 2,
  },
  {
    id: "sec-g8s-1",
    courseId: "co-g8-science",
    title: "01 · Living things",
    position: 0,
  },
  {
    id: "sec-g8s-2",
    courseId: "co-g8-science",
    title: "02 · Matter & energy",
    position: 1,
  },
  {
    id: "sec-g9i-1",
    courseId: "co-g9-ict",
    title: "01 · Computer systems",
    position: 0,
  },
  {
    id: "sec-g9i-2",
    courseId: "co-g9-ict",
    title: "02 · Spreadsheets",
    position: 1,
  },
  {
    id: "sec-g13c-1",
    courseId: "co-g13-combined",
    title: "01 · Pure mathematics",
    position: 0,
  },
  {
    id: "sec-g13c-2",
    courseId: "co-g13-combined",
    title: "02 · Applied mathematics",
    position: 1,
  },
  {
    id: "sec-g11m-1",
    courseId: "co-g11-maths",
    title: "01 · Algebra",
    position: 0,
  },
  {
    id: "sec-g11m-2",
    courseId: "co-g11-maths",
    title: "02 · Geometry & trigonometry",
    position: 1,
  },
  {
    id: "sec-g13b-1",
    courseId: "co-g13-business",
    title: "01 · Business environment",
    position: 0,
  },
  {
    id: "sec-adult-1",
    courseId: "co-adult-ict",
    title: "01 · Foundations",
    position: 0,
  },
]

export const courseSections: ContentSectionRecord[] = sectionSeeds

const sectionIndex = new Map(
  courseSections.map((section) => [section.id, section])
)

export function getCourseSections(courseId: string) {
  return courseSections
    .filter((section) => section.courseId === courseId)
    .sort((left, right) => left.position - right.position)
}

export function getSectionById(sectionId: string) {
  return sectionIndex.get(sectionId)
}

function lecturerName(lecturerId: string) {
  return (
    lecturers.find((lecturer) => lecturer.id === lecturerId)?.fullName ??
    "Unknown lecturer"
  )
}

function branchName(branchId: string) {
  return branches.find((branch) => branch.id === branchId)?.name ?? branchId
}

type PlacementSeed = {
  /** `${courseId}` optionally followed by `#${sectionId}`. */
  ref: string
}

type ContentSeed = {
  id: string
  title: string
  description?: string
  kind: ContentKind
  lecturerId: string
  externalUrl?: string
  fileName?: string
  fileLabel?: string
  accessType: ContentAccessType
  price?: number
  status: ContentStatus
  branchIds: string[]
  placements?: PlacementSeed[]
  createdAt: string
  updatedAt: string
}

const contentSeeds: ContentSeed[] = [
  {
    id: "cont-g8m-algebra-video",
    title: "Grade 8 Maths — Algebra walkthrough",
    description:
      "Recorded lesson covering simplifying expressions and solving one-step equations.",
    kind: "recording",
    lecturerId: "lec-4",
    externalUrl: "https://youtu.be/g8-algebra-walkthrough",
    accessType: "course",
    status: "published",
    branchIds: ["br-colombo"],
    placements: [{ ref: "co-g8-maths#sec-g8m-2" }],
    createdAt: "2026-09-14",
    updatedAt: "2026-09-20",
  },
  {
    id: "cont-g8m-worksheet",
    title: "Grade 8 Maths — Practice worksheet 02",
    description: "Printable worksheet with 20 questions and an answer key.",
    kind: "file",
    lecturerId: "lec-4",
    fileName: "g8-maths-worksheet-02.pdf",
    fileLabel: "PDF · 1.2 MB",
    accessType: "course",
    status: "published",
    branchIds: ["br-colombo"],
    placements: [{ ref: "co-g8-maths#sec-g8m-1" }],
    createdAt: "2026-09-16",
    updatedAt: "2026-09-16",
  },
  {
    id: "cont-science-practicals",
    title: "Science practical video series",
    description:
      "Five recorded practicals with apparatus lists and observation tables.",
    kind: "recording",
    lecturerId: "lec-2",
    externalUrl: "https://youtu.be/science-practicals-series",
    accessType: "paid",
    price: 900,
    status: "published",
    branchIds: ["br-colombo", "br-negombo"],
    placements: [{ ref: "co-g8-science#sec-g8s-2" }, { ref: "co-g10-science" }],
    createdAt: "2026-08-30",
    updatedAt: "2026-10-04",
  },
  {
    id: "cont-combined-revision-pack",
    title: "Combined revision pack (digital download)",
    description:
      "Past-paper solutions and formula sheets for A/L Combined Maths.",
    kind: "file",
    lecturerId: "lec-1",
    fileName: "combined-revision-pack.pdf",
    fileLabel: "PDF · 6.4 MB",
    accessType: "paid",
    price: 1500,
    status: "published",
    branchIds: ["br-colombo"],
    placements: [{ ref: "co-g13-combined#sec-g13c-1" }],
    createdAt: "2026-08-12",
    updatedAt: "2026-09-28",
  },
  {
    id: "cont-ol-maths-book",
    title: "O/L Mathematics revision book",
    description: "Printed revision guide with graded exercises.",
    kind: "physical_book",
    lecturerId: "lec-5",
    accessType: "paid",
    price: 1800,
    status: "published",
    branchIds: ["br-colombo", "br-kandy"],
    placements: [{ ref: "co-g11-maths#sec-g11m-1" }],
    createdAt: "2026-07-20",
    updatedAt: "2026-08-02",
  },
  {
    id: "cont-ict-beginners-workbook",
    title: "ICT for Beginners workbook",
    description: "Printed workbook for the adult ICT certificate.",
    kind: "physical_book",
    lecturerId: "lec-3",
    accessType: "paid",
    price: 1200,
    status: "published",
    branchIds: ["br-galle", "br-colombo"],
    placements: [{ ref: "co-adult-ict#sec-adult-1" }],
    createdAt: "2026-06-18",
    updatedAt: "2026-06-18",
  },
  {
    id: "cont-g9-ict-spreadsheets",
    title: "Grade 9 ICT — Spreadsheet basics",
    description: "Screen recording covering formulas, charts and formatting.",
    kind: "recording",
    lecturerId: "lec-3",
    externalUrl: "https://youtu.be/g9-ict-spreadsheets",
    accessType: "course",
    status: "published",
    branchIds: ["br-galle"],
    placements: [{ ref: "co-g9-ict#sec-g9i-2" }],
    createdAt: "2026-09-02",
    updatedAt: "2026-09-05",
  },
  {
    id: "cont-ol-english-grammar",
    title: "O/L English — Grammar notes",
    description: "Free grammar reference for registered students.",
    kind: "file",
    lecturerId: "lec-6",
    fileName: "ol-english-grammar.pdf",
    fileLabel: "PDF · 480 KB",
    accessType: "free_registered",
    status: "published",
    branchIds: ["br-colombo"],
    placements: [{ ref: "co-g11-english" }],
    createdAt: "2026-08-05",
    updatedAt: "2026-08-05",
  },
  {
    id: "cont-al-physics-vectors",
    title: "A/L Physics — Vectors intro",
    description: "Short recording introducing vector addition and resolution.",
    kind: "recording",
    lecturerId: "lec-7",
    externalUrl: "https://youtu.be/al-physics-vectors",
    accessType: "course",
    status: "draft",
    branchIds: ["br-colombo"],
    placements: [],
    createdAt: "2026-10-30",
    updatedAt: "2026-11-01",
  },
  {
    id: "cont-al-business-pastpapers",
    title: "A/L Business Studies past papers",
    description: "Printed book with 2018–2025 past papers and model answers.",
    kind: "physical_book",
    lecturerId: "lec-10",
    accessType: "paid",
    price: 1400,
    status: "published",
    branchIds: ["br-kandy"],
    placements: [{ ref: "co-g13-business#sec-g13b-1" }],
    createdAt: "2026-07-28",
    updatedAt: "2026-08-10",
  },
  {
    id: "cont-business-model-answers",
    title: "A/L Business — Model answers 2025",
    description: "Archived model answers for the 2025 paper.",
    kind: "file",
    lecturerId: "lec-10",
    fileName: "business-model-answers-2025.pdf",
    fileLabel: "PDF · 2.1 MB",
    accessType: "course",
    status: "archived",
    branchIds: ["br-kandy"],
    placements: [{ ref: "co-g13-business" }],
    createdAt: "2026-04-11",
    updatedAt: "2026-06-01",
  },
]

function buildPlacement(
  contentId: string,
  seed: PlacementSeed,
  position: number
): ContentPlacementRecord {
  const [rawCourseId, sectionId] = seed.ref.split("#")
  const courseId = rawCourseId ?? ""
  const course = getCourseById(courseId)
  const section = sectionId ? sectionIndex.get(sectionId) : undefined

  return {
    id: `${contentId}-place-${position + 1}`,
    courseId,
    courseName: course?.name ?? courseId,
    sectionId: section?.courseId === courseId ? (section?.id ?? null) : null,
    sectionTitle:
      section?.courseId === courseId ? (section?.title ?? null) : null,
    position,
  }
}

function buildContentItem(seed: ContentSeed): ContentItemRecord {
  return {
    id: seed.id,
    title: seed.title,
    description: seed.description ?? null,
    kind: seed.kind,
    lecturerId: seed.lecturerId,
    lecturerName: lecturerName(seed.lecturerId),
    externalUrl: seed.kind === "recording" ? (seed.externalUrl ?? null) : null,
    fileName: seed.kind === "file" ? (seed.fileName ?? null) : null,
    fileLabel: seed.kind === "file" ? (seed.fileLabel ?? null) : null,
    accessType: seed.accessType,
    price: seed.accessType === "paid" ? (seed.price ?? null) : null,
    status: seed.status,
    branchIds: seed.branchIds,
    branchNames: seed.branchIds.map(branchName),
    placements: (seed.placements ?? []).map((placement, index) =>
      buildPlacement(seed.id, placement, index)
    ),
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
  }
}

export const contentItems: ContentItemRecord[] =
  contentSeeds.map(buildContentItem)

export function getContentItemById(contentId: string) {
  return contentItems.find((item) => item.id === contentId)
}

export function getContentUsage() {
  const count = (predicate: (item: ContentItemRecord) => boolean) =>
    contentItems.filter(predicate).length

  return {
    total: contentItems.length,
    published: count((item) => item.status === "published"),
    draft: count((item) => item.status === "draft"),
    archived: count((item) => item.status === "archived"),
    paid: count((item) => item.accessType === "paid"),
    course: count((item) => item.accessType === "course"),
    free: count((item) => item.accessType === "free_registered"),
    recordings: count((item) => item.kind === "recording"),
    files: count((item) => item.kind === "file"),
    books: count((item) => item.kind === "physical_book"),
  }
}

export function formatContentPrice(item: ContentItemRecord) {
  return item.price != null ? formatLkr(item.price) : "—"
}

export function contentAccessSummary(item: ContentItemRecord) {
  if (item.accessType === "paid") {
    return item.price != null
      ? `Paid · ${formatLkr(item.price)}`
      : "Paid · price missing"
  }
  return contentAccessLabels[item.accessType]
}

export const contentKindFilterOptions = [
  { value: "all", label: "All kinds" },
  ...(Object.entries(contentKindLabels) as [ContentKind, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const contentAccessFilterOptions = [
  { value: "all", label: "All access types" },
  ...(Object.entries(contentAccessLabels) as [ContentAccessType, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const contentStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...(Object.entries(contentStatusLabels) as [ContentStatus, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const contentLecturerFilterOptions = [
  { value: "all", label: "All lecturers" },
  ...lecturers.map((lecturer) => ({
    value: lecturer.id,
    label: lecturer.fullName,
  })),
]

export const contentBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
]

export const contentKindFormOptions = (
  Object.entries(contentKindLabels) as [ContentKind, string][]
).map(([value, label]) => ({ value, label }))

export const contentAccessFormOptions = (
  Object.entries(contentAccessLabels) as [ContentAccessType, string][]
).map(([value, label]) => ({ value, label }))

export const contentStatusFormOptions = (
  Object.entries(contentStatusLabels) as [ContentStatus, string][]
).map(([value, label]) => ({ value, label }))

export const contentLecturerFormOptions = lecturers.map((lecturer) => ({
  value: lecturer.id,
  label: lecturer.fullName,
}))

export const contentBranchFormOptions = branches.map((branch) => ({
  value: branch.id,
  label: branch.name,
}))

export const contentCourseFormOptions = [
  "co-g2-maths",
  "co-g6-maths",
  "co-g7-maths",
  "co-g8-maths",
  "co-g8-science",
  "co-g9-ict",
  "co-g10-science",
  "co-g11-maths",
  "co-g11-english",
  "co-g12-physics",
  "co-g13-combined",
  "co-g13-business",
  "co-adult-ict",
]
  .map((courseId) => getCourseById(courseId))
  .filter((course): course is NonNullable<typeof course> => course != null)
  .map((course) => ({ value: course.id, label: course.name }))
  .sort((left, right) => left.label.localeCompare(right.label))

export const CONTENT_STORE_MOCK_NOW = `${MOCK_TODAY}T12:00:00+05:30`
