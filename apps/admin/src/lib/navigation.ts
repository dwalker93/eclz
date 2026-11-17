import {
  AwardIcon,
  BellRingIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChartNoAxesCombinedIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileCheck2Icon,
  FileTextIcon,
  FolderOpenIcon,
  GraduationCapIcon,
  HandCoinsIcon,
  HeartHandshakeIcon,
  LandmarkIcon,
  LayersIcon,
  LibraryBigIcon,
  ListChecksIcon,
  MapPinIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PercentIcon,
  PlugZapIcon,
  PresentationIcon,
  ReceiptIcon,
  ReceiptTextIcon,
  ScaleIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"

export type SidebarNavItem = {
  title: string
  url: string
  icon: LucideIcon
  badge?: number
}

export type SidebarNavGroup = {
  label?: string
  items: SidebarNavItem[]
}

export const sidebarNav: SidebarNavGroup[] = [
  {
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: ChartNoAxesCombinedIcon,
        badge: 5,
      },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Students", url: "/students", icon: GraduationCapIcon },
      { title: "Lecturers", url: "/lecturers", icon: PresentationIcon },
      { title: "Guardians", url: "/guardians", icon: HeartHandshakeIcon },
      { title: "Promotions", url: "/promotions", icon: TrendingUpIcon },
    ],
  },
  {
    label: "Academics",
    items: [
      { title: "Courses & Classes", url: "/courses", icon: BookOpenIcon },
      { title: "Subjects", url: "/subjects", icon: LibraryBigIcon },
      {
        title: "Terms & Intakes",
        url: "/terms-intakes",
        icon: CalendarRangeIcon,
      },
      { title: "Grade Levels", url: "/grade-levels", icon: LayersIcon },
      { title: "Timetable", url: "/timetable", icon: CalendarClockIcon },
      { title: "Attendance", url: "/attendance", icon: ClipboardCheckIcon },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        title: "Fee Structures",
        url: "/fee-structures",
        icon: ReceiptTextIcon,
      },
      { title: "Invoices", url: "/invoices", icon: FileTextIcon },
      { title: "Payments", url: "/payments", icon: CreditCardIcon, badge: 7 },
      { title: "Receipts", url: "/receipts", icon: ReceiptIcon },
      { title: "Fee Exceptions", url: "/fee-exceptions", icon: PercentIcon },
      { title: "Payment Methods", url: "/payment-methods", icon: LandmarkIcon },
    ],
  },
  {
    label: "Exams",
    items: [
      { title: "Exams", url: "/exams", icon: FileCheck2Icon },
      { title: "Question Bank", url: "/question-bank", icon: ListChecksIcon },
      { title: "Results", url: "/results", icon: AwardIcon },
    ],
  },
  {
    label: "Content Store",
    items: [
      {
        title: "Content Library",
        url: "/content-library",
        icon: FolderOpenIcon,
      },
      { title: "Purchases", url: "/purchases", icon: ShoppingCartIcon },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Notices", url: "/notices", icon: MegaphoneIcon },
      { title: "Messages", url: "/messages", icon: MessageSquareIcon },
      { title: "Notifications", url: "/notifications", icon: BellRingIcon },
    ],
  },
  {
    label: "Commissions",
    items: [
      { title: "Commission Rules", url: "/commission-rules", icon: ScaleIcon },
      {
        title: "Teacher Payouts",
        url: "/teacher-payouts",
        icon: HandCoinsIcon,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Organization", url: "/organization", icon: Building2Icon },
      { title: "Branches", url: "/branches", icon: MapPinIcon },
      { title: "Users & Roles", url: "/users-roles", icon: ShieldCheckIcon },
      { title: "Audit Log", url: "/audit-log", icon: ScrollTextIcon },
      { title: "Integrations", url: "/integrations", icon: PlugZapIcon },
    ],
  },
]
