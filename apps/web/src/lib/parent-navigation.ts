import {
  AwardIcon,
  BellIcon,
  BookOpenIcon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  HouseIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  ReceiptTextIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WalletCardsIcon,
} from "lucide-react"

import type { PortalNavGroup } from "@/lib/student-navigation"

/**
 * Planned parent portal destinations from the public portal guide. The
 * dashboard, My Children, Courses, Timetable, Attendance, Exams & Results,
 * Invoices & Payments, Receipts, Notices and Messages pages are implemented;
 * every other item is an intentionally disabled placeholder. Parent pages only
 * ever show children linked to this guardian.
 */
export const parentNav: PortalNavGroup[] = [
  {
    items: [{ title: "Dashboard", icon: HouseIcon, url: "/portal/parent" }],
  },
  {
    label: "Family",
    items: [
      {
        title: "My Children",
        icon: UsersRoundIcon,
        url: "/portal/parent/children",
      },
      { title: "Courses", icon: BookOpenIcon, url: "/portal/parent/courses" },
      {
        title: "Timetable",
        icon: CalendarClockIcon,
        url: "/portal/parent/timetable",
      },
      {
        title: "Attendance",
        icon: ClipboardCheckIcon,
        url: "/portal/parent/attendance",
      },
      {
        title: "Exams & Results",
        icon: AwardIcon,
        url: "/portal/parent/exams",
      },
    ],
  },
  {
    label: "Fees",
    items: [
      {
        title: "Invoices & Payments",
        icon: WalletCardsIcon,
        url: "/portal/parent/billing",
      },
      {
        title: "Receipts",
        icon: ReceiptTextIcon,
        url: "/portal/parent/receipts",
      },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        title: "Notices",
        icon: MegaphoneIcon,
        url: "/portal/parent/notices",
      },
      {
        title: "Messages",
        icon: MessagesSquareIcon,
        url: "/portal/parent/messages",
      },
      { title: "Notifications", icon: BellIcon, disabled: true },
    ],
  },
  {
    label: "Account",
    items: [{ title: "My Profile", icon: UserRoundIcon, disabled: true }],
  },
]
