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
 * dashboard, My Courses, Timetable & Sessions, Attendance, Learning Materials,
 * Exams, Question Bank, Results, Notices, Messages, My Earnings and My Profile
 * pages are implemented; every other item is an intentionally disabled
 * placeholder. My Earnings appears only when the commissions module is enabled
 * in the local demo fixtures.
 */
const teachingGroup: PortalNavGroup = {
  label: "Teaching",
  items: [
    {
      title: "My Courses",
      icon: BookOpenIcon,
      url: "/portal/lecturer/courses",
    },
    {
      title: "Timetable & Sessions",
      icon: CalendarClockIcon,
      url: "/portal/lecturer/timetable",
    },
    {
      title: "Attendance",
      icon: ClipboardCheckIcon,
      url: "/portal/lecturer/attendance",
    },
    {
      title: "Learning Materials",
      icon: FolderOpenIcon,
      url: "/portal/lecturer/materials",
    },
  ],
}

const assessmentGroup: PortalNavGroup = {
  label: "Assessment",
  items: [
    {
      title: "Exams",
      icon: FileCheck2Icon,
      url: "/portal/lecturer/exams",
    },
    lecturerModules.onlineExams
      ? {
          title: "Question Bank",
          icon: ListChecksIcon,
          url: "/portal/lecturer/questions",
        }
      : {
          title: "Question Bank",
          icon: ListChecksIcon,
          disabled: true,
        },
    {
      title: "Results",
      icon: AwardIcon,
      url: "/portal/lecturer/results",
    },
  ],
}

const accountGroup: PortalNavGroup = {
  label: "Account",
  items: [
    {
      title: "My Profile",
      icon: UserRoundIcon,
      url: "/portal/lecturer/profile",
    },
  ],
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
      {
        title: "Notices",
        icon: MegaphoneIcon,
        url: "/portal/lecturer/notices",
      },
      {
        title: "Messages",
        icon: MessagesSquareIcon,
        url: "/portal/lecturer/messages",
      },
      { title: "Notifications", icon: BellIcon, disabled: true },
    ],
  },
  ...(lecturerModules.commissions
    ? [
        {
          label: "Earnings",
          items: [
            {
              title: "My Earnings",
              icon: HandCoinsIcon,
              url: "/portal/lecturer/earnings",
            },
          ],
        } satisfies PortalNavGroup,
      ]
    : []),
  accountGroup,
]
