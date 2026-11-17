/**
 * Local mock fixtures for the Messages inbox demo.
 *
 * Mirrors `message_thread`, `thread_participant` and `message`. Thread state
 * (unread, last activity) is derived from the current user's last-read time.
 * Nothing here is persisted. Messages added in the UI stay in this browser
 * session only and are never delivered to anyone.
 */

import { courses } from "@/lib/courses-data"
import { guardians } from "@/lib/guardians-data"
import { lecturers } from "@/lib/lecturers-data"
import { noticeAuthors } from "@/lib/notices-data"
import {
  formatDisplayDate,
  getGradeAsOf,
  getInitials,
  MOCK_TODAY,
  students,
  type StudentRecord,
} from "@/lib/students-data"
import type { GuardianRecord } from "@/lib/guardians-data"

export const CURRENT_USER_ID = "usr-admin-1"
export const MOCK_NOW = `${MOCK_TODAY}T15:30:00+05:30`

export type MessageRole = "Student" | "Guardian" | "Lecturer" | "Staff"

export type MessageParticipant = {
  id: string
  fullName: string
  role: MessageRole
  /** Short context shown under the name: grade, linked student, subject. */
  detail: string
}

export type MessageRecord = {
  id: string
  senderId: string
  body: string
  sentAt: string
}

export type MessageThreadRecord = {
  id: string
  subject: string
  courseId: string | null
  createdBy: string
  createdAt: string
  participantIds: string[]
  messages: MessageRecord[]
  /** Current user's last-read time for this thread. */
  lastReadAt: string | null
}

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

export const messageParticipants: MessageParticipant[] = [
  ...students.map((student) => ({
    id: student.id,
    fullName: student.fullName,
    role: "Student" as const,
    detail: studentDetail(student),
  })),
  ...guardians.map((guardian) => ({
    id: guardian.id,
    fullName: guardian.fullName,
    role: "Guardian" as const,
    detail: guardianDetail(guardian),
  })),
  ...lecturers.map((lecturer) => ({
    id: lecturer.id,
    fullName: lecturer.fullName,
    role: "Lecturer" as const,
    detail: lecturer.qualification,
  })),
  ...noticeAuthors.map((author) => ({
    id: author.id,
    fullName: author.fullName,
    role: "Staff" as const,
    detail: author.role,
  })),
]

const participantById = new Map(
  messageParticipants.map((participant) => [participant.id, participant])
)

export function getMessageParticipant(id: string) {
  return participantById.get(id)
}

export function getMessageParticipantName(id: string) {
  return getMessageParticipant(id)?.fullName ?? "Unknown participant"
}

export function getMessageParticipantInitials(id: string) {
  return getInitials(getMessageParticipantName(id))
}

function message(
  id: string,
  senderId: string,
  body: string,
  sentAt: string
): MessageRecord {
  return { id, senderId, body, sentAt }
}

export const messageThreads: MessageThreadRecord[] = [
  {
    id: "thr-g11-revision",
    subject: "Grade 11 maths revision workshops",
    courseId: "co-g11-maths",
    createdBy: "gu-3",
    createdAt: "2026-11-10T17:40:00+05:30",
    participantIds: ["usr-admin-1", "lec-1", "gu-3"],
    lastReadAt: "2026-11-12T10:00:00+05:30",
    messages: [
      message(
        "msg-1a",
        "gu-3",
        "Good evening. Will the extra revision workshops cover past papers as well?",
        "2026-11-10T17:40:00+05:30"
      ),
      message(
        "msg-1b",
        "lec-1",
        "Yes — the first two sessions are past-paper walkthroughs, and the last session is a timed mock.",
        "2026-11-10T18:05:00+05:30"
      ),
      message(
        "msg-1c",
        "usr-admin-1",
        "I've added the workshop dates to the notice board and shared them with Grade 11 guardians.",
        "2026-11-11T09:15:00+05:30"
      ),
      message(
        "msg-1d",
        "lec-1",
        "Room 2 is booked for all three Saturdays. Please ask students to bring the 2024 paper.",
        "2026-11-12T09:10:00+05:30"
      ),
    ],
  },
  {
    id: "thr-nov-receipt",
    subject: "Fee receipt for Anjali Fernando",
    courseId: null,
    createdBy: "gu-3",
    createdAt: "2026-11-11T10:05:00+05:30",
    participantIds: ["usr-admin-1", "usr-admin-4", "gu-3"],
    lastReadAt: "2026-11-12T16:20:00+05:30",
    messages: [
      message(
        "msg-2a",
        "gu-3",
        "Could you send the receipt for Anjali's November payment? I can't see it in the portal.",
        "2026-11-11T10:05:00+05:30"
      ),
      message(
        "msg-2b",
        "usr-admin-4",
        "The payment is verified. I've re-issued the receipt to your portal email.",
        "2026-11-11T10:42:00+05:30"
      ),
      message(
        "msg-2c",
        "gu-3",
        "Thank you. I can see it now — could you also confirm the December due date?",
        "2026-11-13T08:42:00+05:30"
      ),
    ],
  },
  {
    id: "thr-kandy-cover",
    subject: "Kandy timetable — Grade 7 cover",
    courseId: "co-g7-maths",
    createdBy: "usr-admin-2",
    createdAt: "2026-11-11T14:10:00+05:30",
    participantIds: ["usr-admin-1", "usr-admin-2", "lec-1"],
    lastReadAt: "2026-11-12T16:10:00+05:30",
    messages: [
      message(
        "msg-3a",
        "usr-admin-2",
        "Anushka, can you cover the Kandy Grade 7 weekday class on 18 November? Nadeesha is at the Galle practical.",
        "2026-11-11T14:10:00+05:30"
      ),
      message(
        "msg-3b",
        "lec-1",
        "I can take it. I'll already be at Kandy for the Grade 11 session that evening.",
        "2026-11-11T14:26:00+05:30"
      ),
      message(
        "msg-3c",
        "usr-admin-2",
        "Thanks — I've put you on the timetable and told the branch.",
        "2026-11-12T16:00:00+05:30"
      ),
      message(
        "msg-3d",
        "lec-1",
        "One more thing: the projector in room 3 isn't working. Can we use room 1?",
        "2026-11-12T17:20:00+05:30"
      ),
    ],
  },
  {
    id: "thr-al-paper-review",
    subject: "A/L combined maths paper review",
    courseId: "co-g13-combined",
    createdBy: "usr-admin-3",
    createdAt: "2026-11-12T09:20:00+05:30",
    participantIds: ["usr-admin-1", "usr-admin-3", "lec-1", "stu-4"],
    lastReadAt: "2026-11-12T18:30:00+05:30",
    messages: [
      message(
        "msg-4a",
        "usr-admin-3",
        "Nethmi, the A/L Combined Maths paper review is moving to Thursday 19 November at 4:00 pm.",
        "2026-11-12T09:20:00+05:30"
      ),
      message(
        "msg-4b",
        "stu-4",
        "Noted. Will it be recorded? I have a school practical that afternoon.",
        "2026-11-12T09:44:00+05:30"
      ),
      message(
        "msg-4c",
        "lec-1",
        "It will be recorded and uploaded the same evening. Bring your marked paper if you have it.",
        "2026-11-12T10:05:00+05:30"
      ),
      message(
        "msg-4d",
        "stu-4",
        "Thank you. I'll send my question about question 7 before the session.",
        "2026-11-13T07:55:00+05:30"
      ),
    ],
  },
  {
    id: "thr-portal-walkthrough",
    subject: "Parent portal walkthrough",
    courseId: null,
    createdBy: "gu-6",
    createdAt: "2026-11-09T11:05:00+05:30",
    participantIds: ["usr-admin-1", "gu-6"],
    lastReadAt: "2026-11-10T09:00:00+05:30",
    messages: [
      message(
        "msg-5a",
        "gu-6",
        "Hello, I still can't log in to the parent portal. It says my email isn't linked.",
        "2026-11-09T11:05:00+05:30"
      ),
      message(
        "msg-5b",
        "usr-admin-1",
        "I've linked your email to Tharindu's guardian record. Please try the reset link again.",
        "2026-11-09T11:34:00+05:30"
      ),
      message(
        "msg-5c",
        "gu-6",
        "That worked, thank you.",
        "2026-11-09T12:02:00+05:30"
      ),
    ],
  },
  {
    id: "thr-january-intake",
    subject: "January intake enquiry — digital marketing",
    courseId: "co-digital-marketing",
    createdBy: "stu-14",
    createdAt: "2026-11-08T15:20:00+05:30",
    participantIds: ["usr-admin-1", "usr-admin-3", "stu-14"],
    lastReadAt: "2026-11-10T09:00:00+05:30",
    messages: [
      message(
        "msg-6a",
        "stu-14",
        "I'd like to join the next Digital Marketing intake. Are evening sessions available?",
        "2026-11-08T15:20:00+05:30"
      ),
      message(
        "msg-6b",
        "usr-admin-3",
        "The February intake has two evening batches. I've added the timetable to your portal inbox.",
        "2026-11-08T16:05:00+05:30"
      ),
      message(
        "msg-6c",
        "stu-14",
        "Great, I'll apply this week.",
        "2026-11-10T08:30:00+05:30"
      ),
    ],
  },
  {
    id: "thr-outstanding-balance",
    subject: "Outstanding balance — Kavindu Jayasinghe",
    courseId: null,
    createdBy: "usr-admin-4",
    createdAt: "2026-11-07T09:00:00+05:30",
    participantIds: ["usr-admin-1", "usr-admin-4", "gu-4"],
    lastReadAt: "2026-11-08T09:00:00+05:30",
    messages: [
      message(
        "msg-7a",
        "usr-admin-4",
        "The November instalment for Kavindu is still showing as unpaid. Can you confirm the transfer reference?",
        "2026-11-07T09:00:00+05:30"
      ),
      message(
        "msg-7b",
        "gu-4",
        "We paid on 5 November at the Kandy branch. The slip number is 4471.",
        "2026-11-07T12:15:00+05:30"
      ),
      message(
        "msg-7c",
        "usr-admin-4",
        "Found it — the payment was posted to the wrong student. I've moved it and the balance is clear.",
        "2026-11-07T13:40:00+05:30"
      ),
    ],
  },
  {
    id: "thr-lecturer-agenda",
    subject: "Lecturer meeting agenda — Friday",
    courseId: null,
    createdBy: "usr-admin-1",
    createdAt: "2026-11-12T15:40:00+05:30",
    participantIds: ["usr-admin-1", "usr-admin-2", "lec-1", "lec-5"],
    lastReadAt: "2026-11-12T17:00:00+05:30",
    messages: [
      message(
        "msg-8a",
        "usr-admin-1",
        "Agenda for Friday: term wrap-up, January timetables and exam marking rosters. Please add anything else by Thursday noon.",
        "2026-11-12T15:40:00+05:30"
      ),
      message(
        "msg-8b",
        "lec-5",
        "I'd like to add the physics lab stock count.",
        "2026-11-12T16:10:00+05:30"
      ),
      message(
        "msg-8c",
        "usr-admin-2",
        "Noted. I'll share the Kandy room plan before the meeting.",
        "2026-11-12T16:25:00+05:30"
      ),
    ],
  },
  {
    id: "thr-lab-safety",
    subject: "Grade 8 science lab safety forms",
    courseId: "co-g8-science",
    createdBy: "lec-2",
    createdAt: "2026-11-12T13:30:00+05:30",
    participantIds: ["usr-admin-1", "lec-2", "gu-1"],
    lastReadAt: "2026-11-12T18:00:00+05:30",
    messages: [
      message(
        "msg-9a",
        "lec-2",
        "The Grade 8 science practical forms for Saturday are missing for three students, including Dinuka.",
        "2026-11-12T13:30:00+05:30"
      ),
      message(
        "msg-9b",
        "gu-1",
        "I'll sign and return Dinuka's form at drop-off tomorrow.",
        "2026-11-12T14:05:00+05:30"
      ),
      message(
        "msg-9c",
        "lec-2",
        "Thank you. I've marked him as pending — the form is needed before the lab session.",
        "2026-11-13T10:05:00+05:30"
      ),
    ],
  },
]

export function getThreadLastMessage(thread: MessageThreadRecord) {
  return thread.messages[thread.messages.length - 1]
}

export function getThreadLastActivity(thread: MessageThreadRecord) {
  return getThreadLastMessage(thread)?.sentAt ?? thread.createdAt
}

export function getThreadUnreadCount(thread: MessageThreadRecord) {
  const lastReadAt = thread.lastReadAt ?? ""

  return thread.messages.filter(
    (item) => item.senderId !== CURRENT_USER_ID && item.sentAt > lastReadAt
  ).length
}

export function isThreadUnread(thread: MessageThreadRecord) {
  return getThreadUnreadCount(thread) > 0
}

export function getThreadParticipants(thread: MessageThreadRecord) {
  return thread.participantIds
    .map((id) => getMessageParticipant(id))
    .filter((participant): participant is MessageParticipant =>
      Boolean(participant)
    )
}

export function getThreadOtherParticipants(thread: MessageThreadRecord) {
  return getThreadParticipants(thread).filter(
    (participant) => participant.id !== CURRENT_USER_ID
  )
}

export function getThreadParticipantSummary(thread: MessageThreadRecord) {
  const names = getThreadOtherParticipants(thread).map(
    (participant) => participant.fullName
  )

  if (names.length === 0) return "No other participants"
  if (names.length === 1) return names[0]!
  if (names.length === 2) return names.join(" · ")

  return `${names[0]} · ${names[1]} +${names.length - 2}`
}

export function getThreadCourse(thread: MessageThreadRecord) {
  if (!thread.courseId) return null

  return courses.find((course) => course.id === thread.courseId) ?? null
}

export function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Colombo",
  }).format(new Date(value))
}

export function formatMessageListTime(value: string) {
  const date = value.slice(0, 10)

  if (date === MOCK_TODAY) return formatMessageTime(value)
  if (date === previousMockDate()) return "Yesterday"

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Colombo",
  }).format(new Date(value))
}

function previousMockDate() {
  const previous = new Date(`${MOCK_TODAY}T12:00:00+05:30`)
  previous.setDate(previous.getDate() - 1)

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Colombo",
  }).format(previous)
}

export function formatMessageDayHeading(date: string) {
  if (date === MOCK_TODAY) return `Today · ${formatDisplayDate(date)}`
  if (date === previousMockDate()) {
    return `Yesterday · ${formatDisplayDate(date)}`
  }

  return formatDisplayDate(date)
}

export type MessageDayGroup = {
  date: string
  messages: MessageRecord[]
}

export function groupMessagesByDay(
  messages: MessageRecord[]
): MessageDayGroup[] {
  const groups: MessageDayGroup[] = []

  for (const item of messages) {
    const date = item.sentAt.slice(0, 10)
    const current = groups[groups.length - 1]

    if (current?.date === date) {
      current.messages.push(item)
    } else {
      groups.push({ date, messages: [item] })
    }
  }

  return groups
}

export const messageRoleFilterOptions = [
  { value: "all", label: "All roles" },
  { value: "Student", label: "Students" },
  { value: "Guardian", label: "Guardians" },
  { value: "Lecturer", label: "Lecturers" },
  { value: "Staff", label: "Staff" },
]

export const messageCourseOptions = courses.map((course) => ({
  value: course.id,
  label: course.name,
}))

export function getMessageCourseLabel(courseId: string | null | undefined) {
  if (!courseId) return null

  return courses.find((course) => course.id === courseId)?.name ?? null
}
