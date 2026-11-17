/**
 * Local mock fixtures for the Notifications UI demo.
 *
 * Mirrors `notification`, `notification_channel` and `notification_template`.
 * The delivery log is read-only: nothing is queued, retried or sent. Channel
 * switches and template edits stay in local component state. Channel provider
 * labels and masked credential references are shared with the Integrations
 * fixtures so the two screens agree.
 */

import { guardians } from "@/lib/guardians-data"
import { lecturers } from "@/lib/lecturers-data"
import { noticeAuthors } from "@/lib/notices-data"
import {
  getGradeAsOf,
  MOCK_TODAY,
  students,
  type StudentRecord,
} from "@/lib/students-data"
import type { GuardianRecord } from "@/lib/guardians-data"
import type { LecturerRecord } from "@/lib/lecturers-data"

export const MOCK_NOW = `${MOCK_TODAY}T15:30:00+05:30`

export const NOTIFICATION_CHANNELS = ["in_app", "email", "sms", "push"] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const NOTIFICATION_EVENTS = [
  "payment_submitted",
  "payment_verified",
  "payment_rejected",
  "receipt_issued",
  "installment_due",
  "installment_overdue",
  "attendance_marked",
  "class_reminder",
  "exam_published",
  "notice",
] as const
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]

export const NOTIFICATION_STATUSES = ["queued", "sent", "failed"] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export type RecipientRole = "Staff" | "Student" | "Guardian" | "Lecturer"

export type NotificationRecipient = {
  id: string
  fullName: string
  role: RecipientRole
  /** Short context: role label, student number + grade, linked student. */
  detail: string
  email: string | null
  phone: string | null
}

export type NotificationRecord = {
  id: string
  recipientId: string
  event: NotificationEvent
  channel: NotificationChannel
  /** Identifies the thing that caused the notification, for deduplication. */
  eventKey: string
  status: NotificationStatus
  createdAt: string
  sentAt: string | null
  /** Only meaningful for in-app notifications. */
  readAt: string | null
  error: string | null
  payload: Record<string, string>
}

export type NotificationTemplateRecord = {
  id: string
  event: NotificationEvent
  channel: NotificationChannel
  subject: string | null
  body: string
  updatedAt: string
}

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  in_app: "In-app",
  email: "Email",
  sms: "SMS",
  push: "Push",
}

export const notificationChannelDescriptions: Record<
  NotificationChannel,
  string
> = {
  in_app: "Shown inside the admin and portal apps. Always available.",
  email: "Transactional email through the configured provider.",
  sms: "Short text messages through the local SMS gateway.",
  push: "Browser and device push through web-push subscriptions.",
}

export const notificationEventLabels: Record<NotificationEvent, string> = {
  payment_submitted: "Payment submitted",
  payment_verified: "Payment verified",
  payment_rejected: "Payment rejected",
  receipt_issued: "Receipt issued",
  installment_due: "Instalment due",
  installment_overdue: "Instalment overdue",
  attendance_marked: "Attendance marked",
  class_reminder: "Class reminder",
  exam_published: "Exam published",
  notice: "Notice published",
}

export const notificationEventDescriptions: Record<NotificationEvent, string> = {
  payment_submitted: "A guardian or student uploads a payment proof.",
  payment_verified: "Finance verifies a submitted payment.",
  payment_rejected: "Finance rejects a payment proof.",
  receipt_issued: "A receipt is issued after verification.",
  installment_due: "An instalment is approaching its due date.",
  installment_overdue: "An instalment passed its due date.",
  attendance_marked: "Attendance is recorded for a class session.",
  class_reminder: "A class session is starting soon.",
  exam_published: "Exam marks are published for a student.",
  notice: "A notice is published to its audience.",
}

export const notificationStatusLabels: Record<NotificationStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  failed: "Failed",
}

export function formatPayloadLabel(key: string) {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

/* ------------------------------------------------------------------ */
/* Recipients                                                          */
/* ------------------------------------------------------------------ */

function studentDetail(student: StudentRecord) {
  const grade = getGradeAsOf(student)

  return `${student.studentNo}${grade ? ` · ${grade.gradeName}` : ""}`
}

function guardianDetail(guardian: GuardianRecord) {
  const link = guardian.links[0]
  const student = link
    ? students.find((item) => item.id === link.studentId)
    : undefined

  return student ? `Guardian of ${student.fullName}` : "No linked student"
}

function studentRecipient(id: string): NotificationRecipient {
  const student = students.find((item) => item.id === id)!

  return {
    id: student.id,
    fullName: student.fullName,
    role: "Student",
    detail: studentDetail(student),
    email: student.contactEmail,
    phone: student.contactPhone,
  }
}

function guardianRecipient(id: string): NotificationRecipient {
  const guardian = guardians.find((item) => item.id === id)!

  return {
    id: guardian.id,
    fullName: guardian.fullName,
    role: "Guardian",
    detail: guardianDetail(guardian),
    email: guardian.accountEmail ?? guardian.email,
    phone: guardian.phone,
  }
}

function lecturerRecipient(id: string): NotificationRecipient {
  const lecturer = lecturers.find((item) => item.id === id)!

  return {
    id: lecturer.id,
    fullName: lecturer.fullName,
    role: "Lecturer",
    detail: lecturer.qualification,
    email: lecturer.accountEmail,
    phone: null,
  }
}

function staffPhones(id: string) {
  const index = noticeAuthors.findIndex((author) => author.id === id)

  return [
    "+94 77 100 0001",
    "+94 77 100 0002",
    "+94 77 100 0003",
    "+94 77 100 0004",
  ][index]!
}

function staffRecipient(id: string): NotificationRecipient {
  const author = noticeAuthors.find((item) => item.id === id)!

  return {
    id: author.id,
    fullName: author.fullName,
    role: "Staff",
    detail: author.role,
    email: `${author.fullName.toLowerCase().replaceAll(" ", ".")}@eclz.lk`,
    phone: staffPhones(author.id),
  }
}

export const notificationRecipients: NotificationRecipient[] = [
  ...(["usr-admin-1", "usr-admin-2", "usr-admin-3", "usr-admin-4"] as const).map(
    staffRecipient
  ),
  ...["stu-1", "stu-2", "stu-4", "stu-14"].map(studentRecipient),
  ...["gu-1", "gu-3", "gu-4", "gu-6"].map(guardianRecipient),
  ...["lec-1", "lec-2", "lec-5"].map(lecturerRecipient),
]

const recipientById = new Map(
  notificationRecipients.map((recipient) => [recipient.id, recipient])
)

export function getNotificationRecipient(id: string) {
  return recipientById.get(id)
}

export function getNotificationRecipientName(id: string) {
  return getNotificationRecipient(id)?.fullName ?? "Unknown recipient"
}

/* ------------------------------------------------------------------ */
/* Delivery log                                                        */
/* ------------------------------------------------------------------ */

type NotificationSeed = Omit<
  NotificationRecord,
  "sentAt" | "readAt" | "error"
> & {
  sentAt?: string | null
  readAt?: string | null
  error?: string | null
}

const deliverySeeds: NotificationSeed[] = [
  {
    id: "ntf-1050",
    recipientId: "gu-4",
    event: "payment_verified",
    channel: "email",
    eventKey: "payment:pay-1042",
    status: "queued",
    createdAt: "2026-11-13T15:25:00+05:30",
    payload: {
      guardian_name: "Chaminda Jayasinghe",
      student_name: "Kavindu Jayasinghe",
      invoice_no: "INV-2026-1099",
      amount: "LKR 6,000",
      method: "Cash at branch",
      receipt_no: "RCP-2026-0879",
    },
  },
  {
    id: "ntf-1049",
    recipientId: "gu-1",
    event: "notice",
    channel: "push",
    eventKey: "notice:ntc-2026-12-fees",
    status: "queued",
    createdAt: "2026-11-13T15:20:00+05:30",
    payload: {
      notice_title: "December 2026 term fees due",
      author_name: "Dilani Jayawardena",
    },
  },
  {
    id: "ntf-1048",
    recipientId: "gu-3",
    event: "installment_due",
    channel: "email",
    eventKey: "installment:inv-2026-1184:2026-12-15",
    status: "sent",
    createdAt: "2026-11-13T14:20:00+05:30",
    sentAt: "2026-11-13T14:21:00+05:30",
    payload: {
      guardian_name: "Sunethra Fernando",
      student_name: "Anjali Fernando",
      invoice_no: "INV-2026-1184",
      amount: "LKR 4,500",
      due_date: "15 Dec 2026",
    },
  },
  {
    id: "ntf-1047",
    recipientId: "gu-3",
    event: "installment_due",
    channel: "sms",
    eventKey: "installment:inv-2026-1184:2026-12-15",
    status: "sent",
    createdAt: "2026-11-13T14:20:00+05:30",
    sentAt: "2026-11-13T14:20:00+05:30",
    payload: {
      guardian_name: "Sunethra Fernando",
      student_name: "Anjali Fernando",
      invoice_no: "INV-2026-1184",
      amount: "LKR 4,500",
      due_date: "15 Dec 2026",
    },
  },
  {
    id: "ntf-1046",
    recipientId: "gu-3",
    event: "installment_due",
    channel: "in_app",
    eventKey: "installment:inv-2026-1184:2026-12-15",
    status: "sent",
    createdAt: "2026-11-13T14:20:00+05:30",
    sentAt: "2026-11-13T14:20:00+05:30",
    payload: {
      guardian_name: "Sunethra Fernando",
      student_name: "Anjali Fernando",
      invoice_no: "INV-2026-1184",
      amount: "LKR 4,500",
      due_date: "15 Dec 2026",
    },
  },
  {
    id: "ntf-1045",
    recipientId: "stu-2",
    event: "class_reminder",
    channel: "push",
    eventKey: "session:ses-g11-maths-2026-11-14",
    status: "sent",
    createdAt: "2026-11-13T13:05:00+05:30",
    sentAt: "2026-11-13T13:05:00+05:30",
    payload: {
      student_name: "Anjali Fernando",
      course_name: "Grade 11 Mathematics — O/L",
      session_date: "14 Nov 2026",
      starts_at: "4:00 pm",
      branch_name: "Colombo",
    },
  },
  {
    id: "ntf-1044",
    recipientId: "stu-2",
    event: "class_reminder",
    channel: "in_app",
    eventKey: "session:ses-g11-maths-2026-11-14",
    status: "sent",
    createdAt: "2026-11-13T13:05:00+05:30",
    sentAt: "2026-11-13T13:05:00+05:30",
    readAt: "2026-11-13T13:06:00+05:30",
    payload: {
      student_name: "Anjali Fernando",
      course_name: "Grade 11 Mathematics — O/L",
      session_date: "14 Nov 2026",
      starts_at: "4:00 pm",
      branch_name: "Colombo",
    },
  },
  {
    id: "ntf-1043",
    recipientId: "stu-1",
    event: "attendance_marked",
    channel: "in_app",
    eventKey: "attendance:att-2026-11-13-stu-1",
    status: "sent",
    createdAt: "2026-11-13T11:40:00+05:30",
    sentAt: "2026-11-13T11:40:00+05:30",
    readAt: "2026-11-13T11:42:00+05:30",
    payload: {
      student_name: "Dinuka Perera",
      course_name: "Grade 8 Science — Saturday",
      session_date: "13 Nov 2026",
      status: "Present",
    },
  },
  {
    id: "ntf-1042",
    recipientId: "usr-admin-4",
    event: "payment_submitted",
    channel: "in_app",
    eventKey: "payment:pay-1042",
    status: "sent",
    createdAt: "2026-11-13T10:15:00+05:30",
    sentAt: "2026-11-13T10:15:00+05:30",
    payload: {
      guardian_name: "Chaminda Jayasinghe",
      student_name: "Kavindu Jayasinghe",
      invoice_no: "INV-2026-1099",
      amount: "LKR 6,000",
      method: "Cash at branch",
    },
  },
  {
    id: "ntf-1041",
    recipientId: "usr-admin-4",
    event: "payment_submitted",
    channel: "email",
    eventKey: "payment:pay-1042",
    status: "queued",
    createdAt: "2026-11-13T10:15:00+05:30",
    payload: {
      guardian_name: "Chaminda Jayasinghe",
      student_name: "Kavindu Jayasinghe",
      invoice_no: "INV-2026-1099",
      amount: "LKR 6,000",
      method: "Cash at branch",
    },
  },
  {
    id: "ntf-1040",
    recipientId: "usr-admin-1",
    event: "payment_submitted",
    channel: "push",
    eventKey: "payment:pay-1042",
    status: "queued",
    createdAt: "2026-11-13T10:15:00+05:30",
    payload: {
      guardian_name: "Chaminda Jayasinghe",
      student_name: "Kavindu Jayasinghe",
      invoice_no: "INV-2026-1099",
      amount: "LKR 6,000",
      method: "Cash at branch",
    },
  },
  {
    id: "ntf-1039",
    recipientId: "gu-1",
    event: "payment_verified",
    channel: "email",
    eventKey: "payment:pay-1038",
    status: "sent",
    createdAt: "2026-11-12T16:40:00+05:30",
    sentAt: "2026-11-12T16:40:00+05:30",
    payload: {
      guardian_name: "Nimal Perera",
      student_name: "Dinuka Perera",
      invoice_no: "INV-2026-1152",
      amount: "LKR 4,500",
      method: "Bank transfer",
      receipt_no: "RCP-2026-0874",
    },
  },
  {
    id: "ntf-1038",
    recipientId: "gu-1",
    event: "payment_verified",
    channel: "sms",
    eventKey: "payment:pay-1038",
    status: "failed",
    createdAt: "2026-11-12T16:40:00+05:30",
    error:
      "SMS provider rejected the message: the sender ID is not permitted for this route.",
    payload: {
      guardian_name: "Nimal Perera",
      student_name: "Dinuka Perera",
      invoice_no: "INV-2026-1152",
      amount: "LKR 4,500",
      method: "Bank transfer",
      receipt_no: "RCP-2026-0874",
    },
  },
  {
    id: "ntf-1037",
    recipientId: "gu-1",
    event: "payment_verified",
    channel: "in_app",
    eventKey: "payment:pay-1038",
    status: "sent",
    createdAt: "2026-11-12T16:41:00+05:30",
    sentAt: "2026-11-12T16:41:00+05:30",
    readAt: "2026-11-13T08:12:00+05:30",
    payload: {
      guardian_name: "Nimal Perera",
      student_name: "Dinuka Perera",
      invoice_no: "INV-2026-1152",
      amount: "LKR 4,500",
      method: "Bank transfer",
      receipt_no: "RCP-2026-0874",
    },
  },
  {
    id: "ntf-1036",
    recipientId: "gu-1",
    event: "receipt_issued",
    channel: "email",
    eventKey: "receipt:rcp-2026-0874",
    status: "sent",
    createdAt: "2026-11-12T16:41:00+05:30",
    sentAt: "2026-11-12T16:41:00+05:30",
    payload: {
      student_name: "Dinuka Perera",
      receipt_no: "RCP-2026-0874",
      amount: "LKR 4,500",
      issued_on: "12 Nov 2026",
    },
  },
  {
    id: "ntf-1035",
    recipientId: "gu-1",
    event: "receipt_issued",
    channel: "in_app",
    eventKey: "receipt:rcp-2026-0874",
    status: "sent",
    createdAt: "2026-11-12T16:41:00+05:30",
    sentAt: "2026-11-12T16:41:00+05:30",
    payload: {
      student_name: "Dinuka Perera",
      receipt_no: "RCP-2026-0874",
      amount: "LKR 4,500",
      issued_on: "12 Nov 2026",
    },
  },
  {
    id: "ntf-1034",
    recipientId: "stu-4",
    event: "exam_published",
    channel: "in_app",
    eventKey: "exam:exam-g12-phy-u3:stu-4",
    status: "sent",
    createdAt: "2026-11-12T15:10:00+05:30",
    sentAt: "2026-11-12T15:10:00+05:30",
    payload: {
      student_name: "Nethmi Silva",
      exam_name: "Grade 12 Physics — Unit 3 Test",
      course_name: "Grade 12 Physics — Theory",
      marks: "84 / 100",
    },
  },
  {
    id: "ntf-1033",
    recipientId: "stu-4",
    event: "exam_published",
    channel: "push",
    eventKey: "exam:exam-g12-phy-u3:stu-4",
    status: "sent",
    createdAt: "2026-11-12T15:10:00+05:30",
    sentAt: "2026-11-12T15:10:00+05:30",
    payload: {
      student_name: "Nethmi Silva",
      exam_name: "Grade 12 Physics — Unit 3 Test",
      course_name: "Grade 12 Physics — Theory",
      marks: "84 / 100",
    },
  },
  {
    id: "ntf-1032",
    recipientId: "stu-4",
    event: "exam_published",
    channel: "email",
    eventKey: "exam:exam-g12-phy-u3:stu-4",
    status: "failed",
    createdAt: "2026-11-12T15:10:00+05:30",
    error: "Mailbox provider rejected the recipient address.",
    payload: {
      student_name: "Nethmi Silva",
      exam_name: "Grade 12 Physics — Unit 3 Test",
      course_name: "Grade 12 Physics — Theory",
      marks: "84 / 100",
    },
  },
  {
    id: "ntf-1031",
    recipientId: "gu-3",
    event: "notice",
    channel: "in_app",
    eventKey: "notice:ntc-2026-ol-revision",
    status: "sent",
    createdAt: "2026-11-12T14:30:00+05:30",
    sentAt: "2026-11-12T14:30:00+05:30",
    readAt: "2026-11-12T18:02:00+05:30",
    payload: {
      notice_title: "Colombo O/L revision workshops",
      author_name: "Priya Selvarajah",
    },
  },
  {
    id: "ntf-1030",
    recipientId: "gu-3",
    event: "notice",
    channel: "email",
    eventKey: "notice:ntc-2026-ol-revision",
    status: "sent",
    createdAt: "2026-11-12T14:31:00+05:30",
    sentAt: "2026-11-12T14:31:00+05:30",
    payload: {
      notice_title: "Colombo O/L revision workshops",
      author_name: "Priya Selvarajah",
    },
  },
  {
    id: "ntf-1029",
    recipientId: "gu-3",
    event: "notice",
    channel: "push",
    eventKey: "notice:ntc-2026-ol-revision",
    status: "failed",
    createdAt: "2026-11-12T14:31:00+05:30",
    error: "Push endpoint expired; the subscription was removed.",
    payload: {
      notice_title: "Colombo O/L revision workshops",
      author_name: "Priya Selvarajah",
    },
  },
  {
    id: "ntf-1028",
    recipientId: "gu-4",
    event: "installment_overdue",
    channel: "email",
    eventKey: "installment:inv-2026-1099:2026-12-05",
    status: "sent",
    createdAt: "2026-11-12T09:00:00+05:30",
    sentAt: "2026-11-12T09:00:00+05:30",
    payload: {
      guardian_name: "Chaminda Jayasinghe",
      student_name: "Kavindu Jayasinghe",
      invoice_no: "INV-2026-1099",
      amount: "LKR 6,000",
      due_date: "5 Dec 2026",
      days_overdue: "6",
    },
  },
  {
    id: "ntf-1027",
    recipientId: "gu-4",
    event: "installment_overdue",
    channel: "sms",
    eventKey: "installment:inv-2026-1099:2026-12-05",
    status: "sent",
    createdAt: "2026-11-12T09:00:00+05:30",
    sentAt: "2026-11-12T09:01:00+05:30",
    payload: {
      guardian_name: "Chaminda Jayasinghe",
      student_name: "Kavindu Jayasinghe",
      invoice_no: "INV-2026-1099",
      amount: "LKR 6,000",
      due_date: "5 Dec 2026",
      days_overdue: "6",
    },
  },
  {
    id: "ntf-1026",
    recipientId: "gu-4",
    event: "installment_overdue",
    channel: "in_app",
    eventKey: "installment:inv-2026-1099:2026-12-05",
    status: "sent",
    createdAt: "2026-11-12T09:00:00+05:30",
    sentAt: "2026-11-12T09:00:00+05:30",
    readAt: "2026-11-12T09:05:00+05:30",
    payload: {
      guardian_name: "Chaminda Jayasinghe",
      student_name: "Kavindu Jayasinghe",
      invoice_no: "INV-2026-1099",
      amount: "LKR 6,000",
      due_date: "5 Dec 2026",
      days_overdue: "6",
    },
  },
  {
    id: "ntf-1025",
    recipientId: "gu-6",
    event: "payment_rejected",
    channel: "email",
    eventKey: "payment:pay-1031",
    status: "sent",
    createdAt: "2026-11-11T17:15:00+05:30",
    sentAt: "2026-11-11T17:15:00+05:30",
    payload: {
      guardian_name: "Deepika Bandara",
      student_name: "Tharindu Bandara",
      invoice_no: "INV-2026-1108",
      amount: "LKR 5,200",
      reason: "The uploaded slip is unreadable.",
    },
  },
  {
    id: "ntf-1024",
    recipientId: "gu-6",
    event: "payment_rejected",
    channel: "in_app",
    eventKey: "payment:pay-1031",
    status: "sent",
    createdAt: "2026-11-11T17:15:00+05:30",
    sentAt: "2026-11-11T17:15:00+05:30",
    readAt: "2026-11-11T19:20:00+05:30",
    payload: {
      guardian_name: "Deepika Bandara",
      student_name: "Tharindu Bandara",
      invoice_no: "INV-2026-1108",
      amount: "LKR 5,200",
      reason: "The uploaded slip is unreadable.",
    },
  },
  {
    id: "ntf-1023",
    recipientId: "gu-6",
    event: "payment_rejected",
    channel: "sms",
    eventKey: "payment:pay-1031",
    status: "failed",
    createdAt: "2026-11-11T17:16:00+05:30",
    error: "Phone number is not reachable on the SMS network.",
    payload: {
      guardian_name: "Deepika Bandara",
      student_name: "Tharindu Bandara",
      invoice_no: "INV-2026-1108",
      amount: "LKR 5,200",
      reason: "The uploaded slip is unreadable.",
    },
  },
  {
    id: "ntf-1022",
    recipientId: "stu-1",
    event: "class_reminder",
    channel: "sms",
    eventKey: "session:ses-g8-maths-2026-11-12",
    status: "sent",
    createdAt: "2026-11-11T18:00:00+05:30",
    sentAt: "2026-11-11T18:00:00+05:30",
    payload: {
      student_name: "Dinuka Perera",
      course_name: "Grade 8 Mathematics — Saturday",
      session_date: "12 Nov 2026",
      starts_at: "4:00 pm",
      branch_name: "Colombo",
    },
  },
  {
    id: "ntf-1021",
    recipientId: "stu-1",
    event: "class_reminder",
    channel: "in_app",
    eventKey: "session:ses-g8-maths-2026-11-12",
    status: "sent",
    createdAt: "2026-11-11T18:00:00+05:30",
    sentAt: "2026-11-11T18:00:00+05:30",
    readAt: "2026-11-11T18:20:00+05:30",
    payload: {
      student_name: "Dinuka Perera",
      course_name: "Grade 8 Mathematics — Saturday",
      session_date: "12 Nov 2026",
      starts_at: "4:00 pm",
      branch_name: "Colombo",
    },
  },
  {
    id: "ntf-1020",
    recipientId: "stu-14",
    event: "notice",
    channel: "email",
    eventKey: "notice:ntc-online-transfer",
    status: "sent",
    createdAt: "2026-11-11T12:05:00+05:30",
    sentAt: "2026-11-11T12:05:00+05:30",
    payload: {
      notice_title: "New online transfer payment option",
      author_name: "Mohamed Nazeer",
    },
  },
  {
    id: "ntf-1019",
    recipientId: "stu-14",
    event: "notice",
    channel: "in_app",
    eventKey: "notice:ntc-online-transfer",
    status: "sent",
    createdAt: "2026-11-11T12:05:00+05:30",
    sentAt: "2026-11-11T12:05:00+05:30",
    payload: {
      notice_title: "New online transfer payment option",
      author_name: "Mohamed Nazeer",
    },
  },
  {
    id: "ntf-1018",
    recipientId: "gu-3",
    event: "payment_verified",
    channel: "email",
    eventKey: "payment:pay-1024",
    status: "sent",
    createdAt: "2026-11-10T10:20:00+05:30",
    sentAt: "2026-11-10T10:20:00+05:30",
    payload: {
      guardian_name: "Sunethra Fernando",
      student_name: "Anjali Fernando",
      invoice_no: "INV-2026-1184",
      amount: "LKR 4,500",
      method: "Online transfer",
      receipt_no: "RCP-2026-0868",
    },
  },
  {
    id: "ntf-1017",
    recipientId: "gu-3",
    event: "payment_verified",
    channel: "in_app",
    eventKey: "payment:pay-1024",
    status: "sent",
    createdAt: "2026-11-10T10:20:00+05:30",
    sentAt: "2026-11-10T10:20:00+05:30",
    readAt: "2026-11-10T12:00:00+05:30",
    payload: {
      guardian_name: "Sunethra Fernando",
      student_name: "Anjali Fernando",
      invoice_no: "INV-2026-1184",
      amount: "LKR 4,500",
      method: "Online transfer",
      receipt_no: "RCP-2026-0868",
    },
  },
  {
    id: "ntf-1016",
    recipientId: "gu-1",
    event: "attendance_marked",
    channel: "in_app",
    eventKey: "attendance:att-2026-11-10-stu-1",
    status: "sent",
    createdAt: "2026-11-10T09:30:00+05:30",
    sentAt: "2026-11-10T09:30:00+05:30",
    readAt: "2026-11-10T10:00:00+05:30",
    payload: {
      student_name: "Dinuka Perera",
      course_name: "Grade 8 Science — Saturday",
      session_date: "10 Nov 2026",
      status: "Present",
    },
  },
  {
    id: "ntf-1015",
    recipientId: "gu-1",
    event: "attendance_marked",
    channel: "push",
    eventKey: "attendance:att-2026-11-10-stu-1",
    status: "sent",
    createdAt: "2026-11-10T09:30:00+05:30",
    sentAt: "2026-11-10T09:30:00+05:30",
    payload: {
      student_name: "Dinuka Perera",
      course_name: "Grade 8 Science — Saturday",
      session_date: "10 Nov 2026",
      status: "Present",
    },
  },
  {
    id: "ntf-1014",
    recipientId: "gu-1",
    event: "installment_due",
    channel: "sms",
    eventKey: "installment:inv-2026-1152:2026-11-15",
    status: "failed",
    createdAt: "2026-11-10T08:00:00+05:30",
    error: "SMS provider rejected the message: the daily send cap was reached.",
    payload: {
      guardian_name: "Nimal Perera",
      student_name: "Dinuka Perera",
      invoice_no: "INV-2026-1152",
      amount: "LKR 4,500",
      due_date: "15 Nov 2026",
    },
  },
  {
    id: "ntf-1013",
    recipientId: "stu-4",
    event: "exam_published",
    channel: "email",
    eventKey: "exam:exam-g12-phy-u2:stu-4",
    status: "sent",
    createdAt: "2026-11-09T16:00:00+05:30",
    sentAt: "2026-11-09T16:01:00+05:30",
    payload: {
      student_name: "Nethmi Silva",
      exam_name: "Grade 12 Physics — Unit 2 Test",
      course_name: "Grade 12 Physics — Theory",
      marks: "78 / 100",
    },
  },
  {
    id: "ntf-1012",
    recipientId: "gu-6",
    event: "notice",
    channel: "push",
    eventKey: "notice:ntc-grade8-lab-safety",
    status: "sent",
    createdAt: "2026-11-09T11:20:00+05:30",
    sentAt: "2026-11-09T11:20:00+05:30",
    payload: {
      notice_title: "Grade 8 science lab safety",
      author_name: "Priya Selvarajah",
    },
  },
  {
    id: "ntf-1011",
    recipientId: "gu-6",
    event: "notice",
    channel: "in_app",
    eventKey: "notice:ntc-grade8-lab-safety",
    status: "sent",
    createdAt: "2026-11-09T11:20:00+05:30",
    sentAt: "2026-11-09T11:20:00+05:30",
    readAt: "2026-11-09T13:40:00+05:30",
    payload: {
      notice_title: "Grade 8 science lab safety",
      author_name: "Priya Selvarajah",
    },
  },
  {
    id: "ntf-1010",
    recipientId: "usr-admin-4",
    event: "payment_submitted",
    channel: "email",
    eventKey: "payment:pay-1029",
    status: "failed",
    createdAt: "2026-11-09T09:10:00+05:30",
    error: "SMTP relay timed out after 30 seconds.",
    payload: {
      guardian_name: "Nimal Perera",
      student_name: "Dinuka Perera",
      invoice_no: "INV-2026-1152",
      amount: "LKR 4,500",
      method: "Bank transfer",
    },
  },
  {
    id: "ntf-1009",
    recipientId: "gu-4",
    event: "installment_due",
    channel: "in_app",
    eventKey: "installment:inv-2026-1099:2026-11-05",
    status: "sent",
    createdAt: "2026-11-09T08:00:00+05:30",
    sentAt: "2026-11-09T08:00:00+05:30",
    readAt: "2026-11-09T08:30:00+05:30",
    payload: {
      guardian_name: "Chaminda Jayasinghe",
      student_name: "Kavindu Jayasinghe",
      invoice_no: "INV-2026-1099",
      amount: "LKR 6,000",
      due_date: "15 Nov 2026",
    },
  },
  {
    id: "ntf-1008",
    recipientId: "gu-6",
    event: "receipt_issued",
    channel: "email",
    eventKey: "receipt:rcp-2026-0851",
    status: "sent",
    createdAt: "2026-11-08T18:30:00+05:30",
    sentAt: "2026-11-08T18:31:00+05:30",
    payload: {
      student_name: "Tharindu Bandara",
      receipt_no: "RCP-2026-0851",
      amount: "LKR 3,800",
      issued_on: "8 Nov 2026",
    },
  },
  {
    id: "ntf-1007",
    recipientId: "gu-6",
    event: "receipt_issued",
    channel: "in_app",
    eventKey: "receipt:rcp-2026-0851",
    status: "sent",
    createdAt: "2026-11-08T18:30:00+05:30",
    sentAt: "2026-11-08T18:30:00+05:30",
    readAt: "2026-11-08T20:05:00+05:30",
    payload: {
      student_name: "Tharindu Bandara",
      receipt_no: "RCP-2026-0851",
      amount: "LKR 3,800",
      issued_on: "8 Nov 2026",
    },
  },
  {
    id: "ntf-1006",
    recipientId: "lec-1",
    event: "notice",
    channel: "in_app",
    eventKey: "notice:ntc-lecturer-meeting",
    status: "sent",
    createdAt: "2026-11-08T09:00:00+05:30",
    sentAt: "2026-11-08T09:00:00+05:30",
    readAt: "2026-11-08T09:30:00+05:30",
    payload: {
      notice_title: "Lecturer monthly meeting",
      author_name: "Dilani Jayawardena",
    },
  },
  {
    id: "ntf-1005",
    recipientId: "lec-1",
    event: "notice",
    channel: "email",
    eventKey: "notice:ntc-lecturer-meeting",
    status: "sent",
    createdAt: "2026-11-08T09:01:00+05:30",
    sentAt: "2026-11-08T09:01:00+05:30",
    payload: {
      notice_title: "Lecturer monthly meeting",
      author_name: "Dilani Jayawardena",
    },
  },
  {
    id: "ntf-1004",
    recipientId: "lec-2",
    event: "class_reminder",
    channel: "push",
    eventKey: "session:ses-g8-sci-2026-11-08",
    status: "sent",
    createdAt: "2026-11-08T07:45:00+05:30",
    sentAt: "2026-11-08T07:45:00+05:30",
    payload: {
      course_name: "Grade 8 Science — Saturday",
      session_date: "8 Nov 2026",
      starts_at: "9:00 am",
      branch_name: "Colombo",
    },
  },
  {
    id: "ntf-1003",
    recipientId: "stu-14",
    event: "attendance_marked",
    channel: "in_app",
    eventKey: "attendance:att-2026-11-08-stu-14",
    status: "sent",
    createdAt: "2026-11-08T07:30:00+05:30",
    sentAt: "2026-11-08T07:30:00+05:30",
    readAt: "2026-11-08T07:31:00+05:30",
    payload: {
      student_name: "Adeesha Karunaratne",
      course_name: "Digital Marketing Foundations — Evening",
      session_date: "8 Nov 2026",
      status: "Present",
    },
  },
]

export const notifications: NotificationRecord[] = deliverySeeds
  .map((seed) => ({
    ...seed,
    sentAt: seed.sentAt ?? null,
    readAt: seed.readAt ?? null,
    error: seed.error ?? null,
  }))
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export function getNotificationSummary(rows: NotificationRecord[]) {
  return {
    total: rows.length,
    queued: rows.filter((row) => row.status === "queued").length,
    sent: rows.filter((row) => row.status === "sent").length,
    failed: rows.filter((row) => row.status === "failed").length,
    unreadInApp: rows.filter(
      (row) =>
        row.channel === "in_app" && row.status === "sent" && !row.readAt
    ).length,
  }
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

/**
 * Sample values used in template previews and payload fixtures. The keys are
 * the supported `{{placeholder}}` names for each event.
 */
export const notificationTemplateSamples: Record<
  NotificationEvent,
  Record<string, string>
> = {
  payment_submitted: {
    guardian_name: "Sunethra Fernando",
    student_name: "Anjali Fernando",
    invoice_no: "INV-2026-1184",
    amount: "LKR 4,500",
    method: "Bank transfer",
  },
  payment_verified: {
    guardian_name: "Nimal Perera",
    student_name: "Dinuka Perera",
    invoice_no: "INV-2026-1152",
    amount: "LKR 4,500",
    method: "Bank transfer",
    receipt_no: "RCP-2026-0874",
  },
  payment_rejected: {
    guardian_name: "Deepika Bandara",
    student_name: "Tharindu Bandara",
    invoice_no: "INV-2026-1108",
    amount: "LKR 5,200",
    reason: "The uploaded slip is unreadable.",
  },
  receipt_issued: {
    student_name: "Dinuka Perera",
    receipt_no: "RCP-2026-0874",
    amount: "LKR 4,500",
    issued_on: "12 Nov 2026",
  },
  installment_due: {
    guardian_name: "Sunethra Fernando",
    student_name: "Anjali Fernando",
    invoice_no: "INV-2026-1184",
    amount: "LKR 4,500",
    due_date: "15 Dec 2026",
  },
  installment_overdue: {
    guardian_name: "Chaminda Jayasinghe",
    student_name: "Kavindu Jayasinghe",
    invoice_no: "INV-2026-1099",
    amount: "LKR 6,000",
    due_date: "5 Dec 2026",
    days_overdue: "6",
  },
  attendance_marked: {
    student_name: "Dinuka Perera",
    course_name: "Grade 8 Science — Saturday",
    session_date: "13 Nov 2026",
    status: "Present",
  },
  class_reminder: {
    student_name: "Anjali Fernando",
    course_name: "Grade 11 Mathematics — O/L",
    session_date: "14 Nov 2026",
    starts_at: "4:00 pm",
    branch_name: "Colombo",
  },
  exam_published: {
    student_name: "Nethmi Silva",
    exam_name: "Grade 12 Physics — Unit 3 Test",
    course_name: "Grade 12 Physics — Theory",
    marks: "84 / 100",
  },
  notice: {
    notice_title: "Colombo O/L revision workshops",
    author_name: "Priya Selvarajah",
  },
}

export function getTemplatePlaceholders(event: NotificationEvent) {
  return Object.keys(notificationTemplateSamples[event])
}

/** Replace `{{key}}` placeholders with the provided values. */
export function renderTemplateValues(
  text: string,
  values: Record<string, string>
) {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
    return values[key] ?? match
  })
}

/** Replace `{{key}}` placeholders with sample values for a preview. */
export function renderTemplatePreview(text: string, event: NotificationEvent) {
  return renderTemplateValues(text, notificationTemplateSamples[event])
}

const notificationTemplateSeeds: NotificationTemplateRecord[] = [
  {
    id: "tpl-payment-submitted-email",
    event: "payment_submitted",
    channel: "email",
    subject: "Payment submitted — {{invoice_no}}",
    body:
      "Hi {{guardian_name}},\n\nWe received the {{method}} payment of {{amount}} for {{student_name}} ({{invoice_no}}). It is waiting for finance verification.\n\nYou will get another message once it is verified.\n\nEclz Admin",
    updatedAt: "2026-11-09T10:15:00+05:30",
  },
  {
    id: "tpl-payment-submitted-in_app",
    event: "payment_submitted",
    channel: "in_app",
    subject: "Payment submitted for {{student_name}}",
    body:
      "{{guardian_name}} submitted a {{method}} payment of {{amount}} for {{invoice_no}}. Verification is pending.",
    updatedAt: "2026-11-09T10:15:00+05:30",
  },
  {
    id: "tpl-payment-verified-email",
    event: "payment_verified",
    channel: "email",
    subject: "Payment verified — receipt {{receipt_no}}",
    body:
      "Hi {{guardian_name}},\n\nThe {{method}} payment of {{amount}} for {{student_name}} has been verified. Receipt {{receipt_no}} is now available in the guardian portal.\n\nThank you,\nEclz Admin",
    updatedAt: "2026-11-10T09:00:00+05:30",
  },
  {
    id: "tpl-payment-verified-sms",
    event: "payment_verified",
    channel: "sms",
    subject: null,
    body:
      "Eclz: Payment of {{amount}} for {{student_name}} is verified. Receipt {{receipt_no}} is in the portal.",
    updatedAt: "2026-11-10T09:00:00+05:30",
  },
  {
    id: "tpl-payment-verified-in_app",
    event: "payment_verified",
    channel: "in_app",
    subject: "Payment verified",
    body:
      "{{amount}} for {{student_name}} is verified. Receipt {{receipt_no}} is ready.",
    updatedAt: "2026-11-10T09:00:00+05:30",
  },
  {
    id: "tpl-payment-rejected-email",
    event: "payment_rejected",
    channel: "email",
    subject: "Payment could not be verified — {{invoice_no}}",
    body:
      "Hi {{guardian_name}},\n\nWe could not verify the payment of {{amount}} for {{student_name}} ({{invoice_no}}).\n\nReason: {{reason}}\n\nPlease upload a clearer proof or speak to the finance desk.\n\nEclz Admin",
    updatedAt: "2026-11-08T14:20:00+05:30",
  },
  {
    id: "tpl-receipt-issued-email",
    event: "receipt_issued",
    channel: "email",
    subject: "Receipt {{receipt_no}} for {{student_name}}",
    body:
      "Hi,\n\nReceipt {{receipt_no}} for {{amount}} was issued to {{student_name}} on {{issued_on}}.\n\nYou can download it from the portal at any time.\n\nEclz Admin",
    updatedAt: "2026-11-07T18:00:00+05:30",
  },
  {
    id: "tpl-installment-due-email",
    event: "installment_due",
    channel: "email",
    subject: "Instalment due {{due_date}} — {{invoice_no}}",
    body:
      "Hi {{guardian_name}},\n\nThe next instalment of {{amount}} for {{student_name}} is due on {{due_date}} ({{invoice_no}}).\n\nPay at the branch or through the online transfer option in the portal.\n\nEclz Admin",
    updatedAt: "2026-11-06T08:30:00+05:30",
  },
  {
    id: "tpl-installment-due-sms",
    event: "installment_due",
    channel: "sms",
    subject: null,
    body:
      "Eclz: {{amount}} for {{student_name}} is due on {{due_date}}. Invoice {{invoice_no}}. Pay at the branch or portal.",
    updatedAt: "2026-11-06T08:30:00+05:30",
  },
  {
    id: "tpl-installment-due-in_app",
    event: "installment_due",
    channel: "in_app",
    subject: "Instalment due {{due_date}}",
    body:
      "{{amount}} for {{student_name}} is due on {{due_date}}. Invoice {{invoice_no}}.",
    updatedAt: "2026-11-06T08:30:00+05:30",
  },
  {
    id: "tpl-installment-overdue-email",
    event: "installment_overdue",
    channel: "email",
    subject: "Overdue instalment — {{invoice_no}}",
    body:
      "Hi {{guardian_name}},\n\nThe instalment of {{amount}} for {{student_name}} was due on {{due_date}} and is now {{days_overdue}} days overdue.\n\nPlease settle it or contact the finance desk so access is not restricted.\n\nEclz Admin",
    updatedAt: "2026-11-05T09:10:00+05:30",
  },
  {
    id: "tpl-installment-overdue-sms",
    event: "installment_overdue",
    channel: "sms",
    subject: null,
    body:
      "Eclz: {{amount}} for {{student_name}} is {{days_overdue}} days overdue. Invoice {{invoice_no}}. Please settle or contact the office.",
    updatedAt: "2026-11-05T09:10:00+05:30",
  },
  {
    id: "tpl-attendance-marked-in_app",
    event: "attendance_marked",
    channel: "in_app",
    subject: "Attendance recorded for {{student_name}}",
    body:
      "{{status}} for {{course_name}} on {{session_date}}.",
    updatedAt: "2026-11-04T16:45:00+05:30",
  },
  {
    id: "tpl-class-reminder-push",
    event: "class_reminder",
    channel: "push",
    subject: null,
    body:
      "{{course_name}} starts at {{starts_at}} on {{session_date}} at {{branch_name}}.",
    updatedAt: "2026-11-03T11:20:00+05:30",
  },
  {
    id: "tpl-class-reminder-in_app",
    event: "class_reminder",
    channel: "in_app",
    subject: "Class reminder — {{course_name}}",
    body:
      "Your class starts at {{starts_at}} on {{session_date}} at the {{branch_name}} branch.",
    updatedAt: "2026-11-03T11:20:00+05:30",
  },
  {
    id: "tpl-exam-published-in_app",
    event: "exam_published",
    channel: "in_app",
    subject: "Marks published — {{exam_name}}",
    body:
      "{{student_name}} scored {{marks}} in {{course_name}}. Open the results page for the full breakdown.",
    updatedAt: "2026-11-02T15:00:00+05:30",
  },
  {
    id: "tpl-exam-published-email",
    event: "exam_published",
    channel: "email",
    subject: "{{exam_name}} marks published",
    body:
      "Hi,\n\nMarks for {{exam_name}} ({{course_name}}) are published. {{student_name}} scored {{marks}}.\n\nSign in to the portal to see the paper breakdown and feedback.\n\nEclz Admin",
    updatedAt: "2026-11-02T15:00:00+05:30",
  },
  {
    id: "tpl-notice-in_app",
    event: "notice",
    channel: "in_app",
    subject: "{{notice_title}}",
    body: "{{author_name}} published a notice: {{notice_title}}.",
    updatedAt: "2026-11-01T09:30:00+05:30",
  },
  {
    id: "tpl-notice-email",
    event: "notice",
    channel: "email",
    subject: "Notice: {{notice_title}}",
    body:
      "Hi,\n\n{{author_name}} published a new notice:\n\n{{notice_title}}\n\nOpen the portal to read the full notice and its audience details.\n\nEclz Admin",
    updatedAt: "2026-11-01T09:30:00+05:30",
  },
  {
    id: "tpl-notice-push",
    event: "notice",
    channel: "push",
    subject: null,
    body: "New notice: {{notice_title}}",
    updatedAt: "2026-11-01T09:30:00+05:30",
  },
]

export const notificationTemplates = [...notificationTemplateSeeds].sort(
  (a, b) =>
    NOTIFICATION_EVENTS.indexOf(a.event) - NOTIFICATION_EVENTS.indexOf(b.event) ||
    NOTIFICATION_CHANNELS.indexOf(a.channel) -
      NOTIFICATION_CHANNELS.indexOf(b.channel)
)

export function getNotificationTemplate(
  event: NotificationEvent,
  channel: NotificationChannel,
  templates: NotificationTemplateRecord[] = notificationTemplates
) {
  return templates.find(
    (template) => template.event === event && template.channel === channel
  )
}

/* ------------------------------------------------------------------ */
/* Filter options                                                      */
/* ------------------------------------------------------------------ */

export const notificationStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...NOTIFICATION_STATUSES.map((status) => ({
    value: status,
    label: notificationStatusLabels[status],
  })),
]

export const notificationChannelFilterOptions = [
  { value: "all", label: "All channels" },
  ...NOTIFICATION_CHANNELS.map((channel) => ({
    value: channel,
    label: notificationChannelLabels[channel],
  })),
]

export const notificationEventFilterOptions = [
  { value: "all", label: "All events" },
  ...NOTIFICATION_EVENTS.map((event) => ({
    value: event,
    label: notificationEventLabels[event],
  })),
]
