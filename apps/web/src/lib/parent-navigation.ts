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
 * dashboard and My Children pages are implemented; every other item is an
 * intentionally disabled placeholder. Parent pages only ever show children
 * linked to this guardian.
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
      { title: "Courses", icon: BookOpenIcon, disabled: true },
      { title: "Timetable", icon: CalendarClockIcon, disabled: true },
      { title: "Attendance", icon: ClipboardCheckIcon, disabled: true },
      { title: "Exams & Results", icon: AwardIcon, disabled: true },
    ],
  },
  {
    label: "Fees",
    items: [
      { title: "Invoices & Payments", icon: WalletCardsIcon, disabled: true },
      { title: "Receipts", icon: ReceiptTextIcon, disabled: true },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Notices", icon: MegaphoneIcon, disabled: true },
      { title: "Messages", icon: MessagesSquareIcon, disabled: true },
      { title: "Notifications", icon: BellIcon, disabled: true },
    ],
  },
  {
    label: "Account",
    items: [{ title: "My Profile", icon: UserRoundIcon, disabled: true }],
  },
]
