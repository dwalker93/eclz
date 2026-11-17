import {
  AwardIcon,
  BellIcon,
  BookOpenIcon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  FileCheck2Icon,
  FolderOpenIcon,
  HandCoinsIcon,
  HouseIcon,
  ListChecksIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  UserRoundIcon,
} from "lucide-react"

import { lecturerModules } from "@/lib/lecturer-portal-data"
import type { PortalNavGroup } from "@/lib/student-navigation"

/**
 * Planned lecturer portal destinations from the public portal guide. The
 * dashboard and My Courses pages are implemented; every other item is an
 * intentionally disabled placeholder. My Earnings appears only when the
 * commissions module is enabled in the local demo fixtures.
 */
const teachingGroup: PortalNavGroup = {
  label: "Teaching",
  items: [
    { title: "My Courses", icon: BookOpenIcon, url: "/portal/lecturer/courses" },
    {
      title: "Timetable & Sessions",
      icon: CalendarClockIcon,
      url: "/portal/lecturer/timetable",
    },
    { title: "Attendance", icon: ClipboardCheckIcon, disabled: true },
    { title: "Learning Materials", icon: FolderOpenIcon, disabled: true },
  ],
}

const assessmentGroup: PortalNavGroup = {
  label: "Assessment",
  items: [
    { title: "Exams", icon: FileCheck2Icon, disabled: true },
    { title: "Question Bank", icon: ListChecksIcon, disabled: true },
    { title: "Results", icon: AwardIcon, disabled: true },
  ],
}

const accountGroup: PortalNavGroup = {
  label: "Account",
  items: [{ title: "My Profile", icon: UserRoundIcon, disabled: true }],
}

export const lecturerNav: PortalNavGroup[] = [
  {
    items: [{ title: "Dashboard", icon: HouseIcon, url: "/portal/lecturer" }],
  },
  teachingGroup,
  assessmentGroup,
  {
    label: "Communication",
    items: [
      { title: "Notices", icon: MegaphoneIcon, disabled: true },
      { title: "Messages", icon: MessagesSquareIcon, disabled: true },
      { title: "Notifications", icon: BellIcon, disabled: true },
    ],
  },
  ...(lecturerModules.commissions
    ? [
        {
          label: "Earnings",
          items: [{ title: "My Earnings", icon: HandCoinsIcon, disabled: true }],
        } satisfies PortalNavGroup,
      ]
    : []),
  accountGroup,
]
