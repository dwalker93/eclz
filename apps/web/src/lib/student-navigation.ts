import {
  BellIcon,
  BookOpenIcon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  FileCheck2Icon,
  FolderOpenIcon,
  HouseIcon,
  LibraryBigIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  ReceiptTextIcon,
  UserRoundIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react"

export type StudentNavItem = {
  title: string
  icon: LucideIcon
  url?: string
  disabled?: boolean
}

export type StudentNavGroup = {
  label?: string
  items: StudentNavItem[]
}

/**
 * Planned student portal destinations from the public portal guide.
 * The dashboard, My Courses, Timetable, Attendance and Learning Materials are
 * implemented. All other items are intentionally shown as disabled placeholders.
 */
export const studentNav: StudentNavGroup[] = [
  {
    items: [{ title: "Dashboard", icon: HouseIcon, url: "/portal/student" }],
  },
  {
    label: "Learning",
    items: [
      {
        title: "My Courses",
        icon: BookOpenIcon,
        url: "/portal/student/courses",
      },
      {
        title: "Timetable",
        icon: CalendarClockIcon,
        url: "/portal/student/timetable",
      },
      {
        title: "Attendance",
        icon: ClipboardCheckIcon,
        url: "/portal/student/attendance",
      },
      {
        title: "Learning Materials",
        icon: LibraryBigIcon,
        url: "/portal/student/materials",
      },
      {
        title: "Exams & Results",
        icon: FileCheck2Icon,
        url: "/portal/student/exams",
      },
    ],
  },
  {
    label: "Fees",
    items: [
      {
        title: "Invoices & Payments",
        icon: WalletCardsIcon,
        url: "/portal/student/billing",
      },
      { title: "Receipts", icon: ReceiptTextIcon, disabled: true },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        title: "Notices",
        icon: MegaphoneIcon,
        url: "/portal/student/notices",
      },
      {
        title: "Messages",
        icon: MessagesSquareIcon,
        url: "/portal/student/messages",
      },
      { title: "Notifications", icon: BellIcon, disabled: true },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "My Profile", icon: UserRoundIcon, url: "/portal/student/profile" },
    ],
  },
]

export type PortalNavItem = StudentNavItem
export type PortalNavGroup = StudentNavGroup
