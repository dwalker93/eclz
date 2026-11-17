import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  BanIcon,
  BanknoteIcon,
  BellIcon,
  BellRingIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleCheckIcon,
  CircleDollarSignIcon,
  CircleXIcon,
  Clock3Icon,
  ClockIcon,
  CreditCardIcon,
  FileTextIcon,
  GraduationCapIcon,
  LandmarkIcon,
  LaptopIcon,
  LockKeyholeIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  MonitorIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
  UsersRoundIcon,
  VideoIcon,
  WalletCardsIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react"

import {
  ATTENDANCE_STATUS_LABELS,
  CLASS_SESSION_STATUS_LABELS,
  COURSE_ACCESS_LABELS,
  COURSE_STATUS_LABELS,
  INSTALLMENT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  MATERIAL_ACCESS_LABELS,
  MATERIAL_ENTITLEMENT_LABELS,
  MATERIAL_KIND_LABELS,
  NOTICE_AUDIENCE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_VERIFICATION_LABELS,
  STUDENT_STATUS_LABELS,
  EXAM_MODE_LABELS,
  EXAM_RESULT_STATE_LABELS,
  type AttendanceStatus,
  type ClassSessionStatus,
  type CourseAccessState,
  type CourseDeliveryMode,
  type ExamMode,
  type ExamResultState,
  type InstallmentStatus,
  type InvoiceStatus,
  type MaterialAccessType,
  type MaterialEntitlement,
  type MaterialKind,
  type NoticeAudienceType,
  type NotificationChannel,
  type NotificationStatus,
  type PaymentMethod,
  type PaymentVerificationStatus,
  type StudentAccountStatus,
  type StudentCourseStatus,
} from "@/lib/student-portal-data"
import {
  LECTURER_CONTENT_STATUS_LABELS,
  LECTURER_COURSE_KIND_LABELS,
  LECTURER_COURSE_STATUS_LABELS,
  LECTURER_EXAM_STATUS_LABELS,
  LECTURER_PAYOUT_STATUS_LABELS,
  type LecturerContentStatus,
  type LecturerCourseKind,
  type LecturerCourseStatus,
  type LecturerExamStatus,
  type LecturerPayoutStatus,
} from "@/lib/lecturer-portal-data"

type BadgeConfig = {
  icon: LucideIcon
  className: string
}

const attendanceConfig: Record<AttendanceStatus, BadgeConfig> = {
  present: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  late: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  absent: {
    icon: CircleXIcon,
    className:
      "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
  },
  excused: {
    icon: ShieldCheckIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
}

const channelConfig: Record<NotificationChannel, BadgeConfig> = {
  in_app: {
    icon: BellIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  email: {
    icon: MailIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  sms: {
    icon: MessageSquareIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  push: {
    icon: BellRingIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
}

const deliveryConfig: Record<NotificationStatus, BadgeConfig> = {
  queued: {
    icon: Clock3Icon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  sent: {
    icon: CheckCircle2Icon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  failed: {
    icon: XCircleIcon,
    className:
      "border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/40",
  },
}

const courseStatusConfig: Record<StudentCourseStatus, BadgeConfig> = {
  active: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  completed: {
    icon: BadgeCheckIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  dropped: {
    icon: CircleXIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
}

const courseAccessConfig: Record<CourseAccessState, BadgeConfig> = {
  full: {
    icon: ShieldCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  restricted: {
    icon: LockKeyholeIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  ended: {
    icon: LockKeyholeIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
}

const deliveryModeConfig: Record<CourseDeliveryMode, BadgeConfig> = {
  Physical: {
    icon: MapPinIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  Online: {
    icon: MonitorIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  Hybrid: {
    icon: LaptopIcon,
    className:
      "border-indigo-600/20 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/20 dark:text-indigo-400",
  },
}

const sessionStatusConfig: Record<ClassSessionStatus, BadgeConfig> = {
  scheduled: {
    icon: CalendarClockIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  held: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  cancelled: {
    icon: CircleXIcon,
    className:
      "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
  },
}

const materialKindConfig: Record<MaterialKind, BadgeConfig> = {
  recording: {
    icon: VideoIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  file: {
    icon: FileTextIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  book: {
    icon: BookOpenIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
}

const materialAccessConfig: Record<MaterialAccessType, BadgeConfig> = {
  course_only: {
    icon: GraduationCapIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  registered: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  paid: {
    icon: WalletCardsIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
}

const materialEntitlementConfig: Record<MaterialEntitlement, BadgeConfig> = {
  available: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  locked: {
    icon: LockKeyholeIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  purchased: {
    icon: BadgeCheckIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
}

function ConfigBadge({
  config,
  label,
  className,
}: {
  config: BadgeConfig
  label: string
  className?: string
}) {
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", config.className, className)}
    >
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function AttendanceStatusBadge({
  status,
  className,
}: {
  status: AttendanceStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={attendanceConfig[status]}
      label={ATTENDANCE_STATUS_LABELS[status]}
      className={className}
    />
  )
}

export function NotificationChannelBadge({
  channel,
  className,
}: {
  channel: NotificationChannel
  className?: string
}) {
  return (
    <ConfigBadge
      config={channelConfig[channel]}
      label={NOTIFICATION_CHANNEL_LABELS[channel]}
      className={className}
    />
  )
}

export function NotificationDeliveryBadge({
  status,
  className,
}: {
  status: NotificationStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={deliveryConfig[status]}
      label={NOTIFICATION_STATUS_LABELS[status]}
      className={className}
    />
  )
}

export function CourseStatusBadge({
  status,
  className,
}: {
  status: StudentCourseStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={courseStatusConfig[status]}
      label={COURSE_STATUS_LABELS[status]}
      className={className}
    />
  )
}

export function CourseAccessBadge({
  state,
  className,
}: {
  state: CourseAccessState
  className?: string
}) {
  return (
    <ConfigBadge
      config={courseAccessConfig[state]}
      label={COURSE_ACCESS_LABELS[state]}
      className={className}
    />
  )
}

export function DeliveryModeBadge({
  mode,
  className,
}: {
  mode: CourseDeliveryMode
  className?: string
}) {
  return (
    <ConfigBadge
      config={deliveryModeConfig[mode]}
      label={mode}
      className={className}
    />
  )
}

export function ClassSessionStatusBadge({
  status,
  className,
}: {
  status: ClassSessionStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={sessionStatusConfig[status]}
      label={CLASS_SESSION_STATUS_LABELS[status]}
      className={className}
    />
  )
}

export function MaterialKindBadge({
  kind,
  className,
}: {
  kind: MaterialKind
  className?: string
}) {
  return (
    <ConfigBadge
      config={materialKindConfig[kind]}
      label={MATERIAL_KIND_LABELS[kind]}
      className={className}
    />
  )
}

export function MaterialAccessBadge({
  accessType,
  className,
}: {
  accessType: MaterialAccessType
  className?: string
}) {
  return (
    <ConfigBadge
      config={materialAccessConfig[accessType]}
      label={MATERIAL_ACCESS_LABELS[accessType]}
      className={className}
    />
  )
}

export function MaterialEntitlementBadge({
  entitlement,
  className,
}: {
  entitlement: MaterialEntitlement
  className?: string
}) {
  return (
    <ConfigBadge
      config={materialEntitlementConfig[entitlement]}
      label={MATERIAL_ENTITLEMENT_LABELS[entitlement]}
      className={className}
    />
  )
}

export function FeeStatusBadge({
  status,
  className,
}: {
  status: "pending" | "partial" | "paid" | "overdue"
  className?: string
}) {
  const config: Record<
    "pending" | "partial" | "paid" | "overdue",
    BadgeConfig & { label: string }
  > = {
    pending: {
      icon: ClockIcon,
      label: "Pending",
      className:
        "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
    },
    partial: {
      icon: CircleDollarSignIcon,
      label: "Partial",
      className:
        "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
    },
    paid: {
      icon: BadgeCheckIcon,
      label: "Paid",
      className:
        "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    },
    overdue: {
      icon: CircleXIcon,
      label: "Overdue",
      className:
        "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
    },
  }

  const selected = config[status]

  return (
    <ConfigBadge
      config={selected}
      label={selected.label}
      className={className}
    />
  )
}

const examModeConfig: Record<ExamMode, BadgeConfig> = {
  online_mcq: {
    icon: MonitorIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  paper: {
    icon: FileTextIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
}

const examResultStateConfig: Record<ExamResultState, BadgeConfig> = {
  pending: {
    icon: ClockIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  provisional: {
    icon: Clock3Icon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  released: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
}

export function ExamModeBadge({
  mode = "paper",
  className,
}: {
  mode?: ExamMode
  className?: string
}) {
  return (
    <ConfigBadge
      config={examModeConfig[mode]}
      label={EXAM_MODE_LABELS[mode]}
      className={className}
    />
  )
}

export function ExamResultStateBadge({
  state,
  className,
}: {
  state: ExamResultState
  className?: string
}) {
  return (
    <ConfigBadge
      config={examResultStateConfig[state]}
      label={EXAM_RESULT_STATE_LABELS[state]}
      className={className}
    />
  )
}

const invoiceStatusConfig: Record<InvoiceStatus, BadgeConfig> = {
  pending: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  partial: {
    icon: CircleDollarSignIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  paid: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  overdue: {
    icon: CircleXIcon,
    className:
      "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
  },
  waived: {
    icon: ShieldCheckIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  cancelled: {
    icon: BanIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
}

const installmentStatusConfig: Record<InstallmentStatus, BadgeConfig> = {
  pending: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  partial: {
    icon: CircleDollarSignIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  paid: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  overdue: {
    icon: CircleXIcon,
    className:
      "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
  },
}

const paymentVerificationConfig: Record<
  PaymentVerificationStatus,
  BadgeConfig
> = {
  pending_verification: {
    icon: Clock3Icon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  verified: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  rejected: {
    icon: XCircleIcon,
    className:
      "border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/40",
  },
}

const paymentMethodConfig: Record<PaymentMethod, BadgeConfig> = {
  bank_transfer: {
    icon: LandmarkIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  cash: {
    icon: BanknoteIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  gateway: {
    icon: CreditCardIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
}

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={invoiceStatusConfig[status]}
      label={INVOICE_STATUS_LABELS[status]}
      className={className}
    />
  )
}

export function InstallmentStatusBadge({
  status,
  className,
}: {
  status: InstallmentStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={installmentStatusConfig[status]}
      label={INSTALLMENT_STATUS_LABELS[status]}
      className={className}
    />
  )
}

export function PaymentVerificationBadge({
  status,
  className,
}: {
  status: PaymentVerificationStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={paymentVerificationConfig[status]}
      label={PAYMENT_VERIFICATION_LABELS[status]}
      className={className}
    />
  )
}

export function PaymentMethodBadge({
  method,
  className,
}: {
  method: PaymentMethod
  className?: string
}) {
  return (
    <ConfigBadge
      config={paymentMethodConfig[method]}
      label={PAYMENT_METHOD_LABELS[method]}
      className={className}
    />
  )
}

const noticeAudienceConfig: Record<NoticeAudienceType, BadgeConfig> = {
  all: {
    icon: UsersIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  branch: {
    icon: Building2Icon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  grade: {
    icon: GraduationCapIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  course: {
    icon: BookOpenIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  student: {
    icon: UserRoundIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
}

export function NoticeAudienceBadge({
  audienceType,
  className,
}: {
  audienceType: NoticeAudienceType
  className?: string
}) {
  return (
    <ConfigBadge
      config={noticeAudienceConfig[audienceType]}
      label={NOTICE_AUDIENCE_LABELS[audienceType]}
      className={className}
    />
  )
}

export function NoticeExpiredBadge({ className }: { className?: string }) {
  return (
    <ConfigBadge
      config={{
        icon: ClockIcon,
        className: "border-border bg-muted/60 text-muted-foreground",
      }}
      label="Expired"
      className={className}
    />
  )
}

export function UnreadBadge({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground tabular-nums",
        className
      )}
      aria-label={`${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

const studentStatusConfig: Record<StudentAccountStatus, BadgeConfig> = {
  active: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  alumni: {
    icon: BadgeCheckIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  suspended: {
    icon: XCircleIcon,
    className:
      "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
  },
}

export function StudentStatusBadge({
  status,
  className,
}: {
  status: StudentAccountStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={studentStatusConfig[status]}
      label={STUDENT_STATUS_LABELS[status]}
      className={className}
    />
  )
}

const lecturerCourseKindConfig: Record<LecturerCourseKind, BadgeConfig> = {
  Class: {
    icon: UsersRoundIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  Program: {
    icon: GraduationCapIcon,
    className:
      "border-indigo-600/20 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/20 dark:text-indigo-400",
  },
}

const lecturerCourseStatusConfig: Record<LecturerCourseStatus, BadgeConfig> = {
  active: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  completed: {
    icon: BadgeCheckIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
}

const lecturerContentStatusConfig: Record<LecturerContentStatus, BadgeConfig> = {
  published: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  draft: {
    icon: Clock3Icon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
}

const lecturerExamStatusConfig: Record<LecturerExamStatus, BadgeConfig> = {
  draft: {
    icon: ClockIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  scheduled: {
    icon: CalendarClockIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  published: {
    icon: CheckCircle2Icon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  closed: {
    icon: BadgeCheckIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
}

const lecturerPayoutStatusConfig: Record<LecturerPayoutStatus, BadgeConfig> = {
  draft: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  approved: {
    icon: CheckCircle2Icon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  paid: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
}

export function LecturerCourseKindBadge({
  kind,
  className,
}: {
  kind: LecturerCourseKind
  className?: string
}) {
  return (
    <ConfigBadge
      config={lecturerCourseKindConfig[kind]}
      label={LECTURER_COURSE_KIND_LABELS[kind]}
      className={className}
    />
  )
}

export function LecturerCourseStatusBadge({
  status,
  className,
}: {
  status: LecturerCourseStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={lecturerCourseStatusConfig[status]}
      label={LECTURER_COURSE_STATUS_LABELS[status]}
      className={className}
    />
  )
}

export function LecturerContentStatusBadge({
  status,
  className,
}: {
  status: LecturerContentStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={lecturerContentStatusConfig[status]}
      label={LECTURER_CONTENT_STATUS_LABELS[status]}
      className={className}
    />
  )
}

export function LecturerExamStatusBadge({
  status,
  className,
}: {
  status: LecturerExamStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={lecturerExamStatusConfig[status]}
      label={LECTURER_EXAM_STATUS_LABELS[status]}
      className={className}
    />
  )
}

export function LecturerPayoutStatusBadge({
  status,
  className,
}: {
  status: LecturerPayoutStatus
  className?: string
}) {
  return (
    <ConfigBadge
      config={lecturerPayoutStatusConfig[status]}
      label={LECTURER_PAYOUT_STATUS_LABELS[status]}
      className={className}
    />
  )
}
