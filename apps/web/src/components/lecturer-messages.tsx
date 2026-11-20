"use client"

import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  InfoIcon,
  MessagesSquareIcon,
  SearchXIcon,
  SendIcon,
  UserRoundIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import { UnreadBadge } from "@/components/portal-status-badge"
import {
  getLecturerParticipantName,
  getLecturerThreadLastMessage,
  getLecturerThreadLastMessageAt,
  getLecturerThreadOtherParticipants,
  getLecturerThreadUnreadCount,
  LECTURER_MESSAGE_SENDER_ID,
  lecturer,
  lecturerCourses,
  lecturerMessageContacts,
  lecturerMessageThreads,
  type LecturerMessageParticipant,
  type LecturerMessageThread,
  type LecturerThreadMessage,
} from "@/lib/lecturer-portal-data"
import {
  formatDateTime,
  formatDisplayDate,
  formatShortDate,
  MOCK_NOW,
  MOCK_TODAY,
} from "@/lib/student-portal-data"

type MobileView = "list" | "conversation"

type NewThreadInput = {
  contact: LecturerMessageParticipant
  subject: string
  body: string
  courseName?: string
}

export function LecturerMessages() {
  const [threads, setThreads] = useState<LecturerMessageThread[]>(
    () => lecturerMessageThreads
  )
  const [readAtMap, setReadAtMap] = useState<Record<string, string>>({})
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => lecturerMessageThreads[0]?.id ?? null
  )
  const [mobileView, setMobileView] = useState<MobileView>("list")
  const [search, setSearch] = useState("")
  const [composerText, setComposerText] = useState("")
  const [newThreadOpen, setNewThreadOpen] = useState(false)

  const sortedThreads = [...threads].sort((first, second) =>
    getLecturerThreadLastMessageAt(second).localeCompare(
      getLecturerThreadLastMessageAt(first)
    )
  )

  const filteredThreads = sortedThreads.filter((thread) => {
    const query = search.trim().toLowerCase()

    if (!query) return true

    const participantNames = getLecturerThreadOtherParticipants(thread)
      .map((participant) => participant.name)
      .join(" ")
      .toLowerCase()

    return (
      thread.subject.toLowerCase().includes(query) ||
      participantNames.includes(query) ||
      (thread.courseName?.toLowerCase().includes(query) ?? false)
    )
  })

  const totalUnread = threads.reduce(
    (total, thread) =>
      total + getLecturerThreadUnreadCount(thread, readAtMap[thread.id]),
    0
  )

  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ?? null

  function openThread(threadId: string) {
    setActiveThreadId(threadId)
    setMobileView("conversation")
    setReadAtMap((current) => ({ ...current, [threadId]: MOCK_NOW }))
  }

  function sendMessage() {
    const body = composerText.trim()

    if (!body || !activeThreadId) return

    setThreads((current) =>
      current.map((thread) =>
        thread.id === activeThreadId
          ? {
              ...thread,
              messages: [
                ...thread.messages,
                {
                  id: `${thread.id}-local-${thread.messages.length + 1}`,
                  senderId: LECTURER_MESSAGE_SENDER_ID,
                  sentAt: MOCK_NOW,
                  body,
                  local: true,
                },
              ],
            }
          : thread
      )
    )
    setComposerText("")
  }

  function createThread({
    contact,
    subject,
    body,
    courseName,
  }: NewThreadInput) {
    const threadId = `local-thread-${contact.id}-${Date.now()}`

    const newThread: LecturerMessageThread = {
      id: threadId,
      subject,
      courseName,
      participants: [
        {
          id: LECTURER_MESSAGE_SENDER_ID,
          name: lecturer.fullName,
          role: lecturer.designation,
        },
        contact,
      ],
      lastReadAt: MOCK_NOW,
      messages: [
        {
          id: `${threadId}-local-1`,
          senderId: LECTURER_MESSAGE_SENDER_ID,
          sentAt: MOCK_NOW,
          body,
          local: true,
        },
      ],
    }

    setThreads((current) => [
      newThread,
      ...current.filter((thread) => thread.id !== threadId),
    ])
    setActiveThreadId(threadId)
    setMobileView("conversation")
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Messages"
          description="Conversations with branch offices, fellow lecturers and guardians linked to your courses. Sample messages only — anything you type here stays on this page and is never sent."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Lecturer portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {lecturer.designation}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {lecturer.branch} branch
              </Badge>
              {totalUnread > 0 ? (
                <Badge variant="outline" className="gap-1.5 rounded-full">
                  {totalUnread} unread
                </Badge>
              ) : null}
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDaysIcon aria-hidden="true" />
                {formatDisplayDate(MOCK_TODAY)}
              </Badge>
              <Button size="sm" onClick={() => setNewThreadOpen(true)}>
                <MessagesSquareIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                New message
              </Button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <UserRoundIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            {lecturer.fullName}
          </span>
          <span className="text-muted-foreground">
            Lecturer no. {lecturer.lecturerNo}
          </span>
          <span className="text-muted-foreground">
            {lecturer.designation} · {lecturer.branch} branch
          </span>
        </div>

        <Card className="gap-0 overflow-hidden py-0">
          <div className="grid md:grid-cols-[minmax(0,20rem)_1fr]">
            <div
              className={cn(
                "flex min-h-0 flex-col border-b md:border-r md:border-b-0",
                mobileView === "conversation" && "hidden md:flex"
              )}
            >
              <div className="border-b p-3">
                <Label htmlFor="lecturer-message-search" className="sr-only">
                  Search conversations
                </Label>
                <Input
                  id="lecturer-message-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search subject, person or course"
                  type="search"
                />
              </div>
              {filteredThreads.length === 0 ? (
                <EmptyState
                  icon={<SearchXIcon className="size-5" aria-hidden="true" />}
                  title="No conversations found"
                  description="Try a different search, or start a new message to a branch office, fellow lecturer or guardian."
                />
              ) : (
                <ul className="flex flex-col divide-y md:h-[32rem] md:overflow-y-auto">
                  {filteredThreads.map((thread) => (
                    <li key={thread.id}>
                      <ThreadListItem
                        thread={thread}
                        unreadCount={getLecturerThreadUnreadCount(
                          thread,
                          readAtMap[thread.id]
                        )}
                        isActive={thread.id === activeThreadId}
                        onOpen={() => openThread(thread.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              className={cn(
                "flex min-h-0 flex-col",
                mobileView === "list" && "hidden md:flex"
              )}
            >
              {activeThread ? (
                <>
                  <ConversationHeader
                    thread={activeThread}
                    onBack={() => setMobileView("list")}
                  />
                  <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-6 md:h-[26rem] md:max-h-[26rem]">
                    {activeThread.messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        thread={activeThread}
                      />
                    ))}
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-2 p-4 sm:p-6">
                    <Label
                      htmlFor="lecturer-message-composer"
                      className="sr-only"
                    >
                      Write a message
                    </Label>
                    <Textarea
                      id="lecturer-message-composer"
                      value={composerText}
                      onChange={(event) => setComposerText(event.target.value)}
                      placeholder="Write a local demo message…"
                      rows={2}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Demo only. Nothing is sent, and the recipient never
                        receives this message.
                      </p>
                      <Button
                        size="sm"
                        onClick={sendMessage}
                        disabled={composerText.trim().length === 0}
                      >
                        <SendIcon data-icon="inline-start" aria-hidden="true" />
                        Add to thread
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={
                    <MessagesSquareIcon className="size-5" aria-hidden="true" />
                  }
                  title="Select a conversation"
                  description="Choose a conversation from the list, or start a new message to a branch office, fellow lecturer or guardian."
                />
              )}
            </div>
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This page uses local sample data. Only conversations you are part
              of are shown, and recipients are limited to branch offices, a
              fellow lecturer and guardians linked to your courses — there is no
              student directory or cross-student browsing. Composing or starting
              a thread does not send anything: messages you add stay in this
              preview and are marked as not delivered.
            </p>
          </CardContent>
        </Card>
      </div>

      <NewThreadDialog
        open={newThreadOpen}
        onOpenChange={setNewThreadOpen}
        onCreate={createThread}
      />
    </main>
  )
}

function ThreadListItem({
  thread,
  unreadCount,
  isActive,
  onOpen,
}: {
  thread: LecturerMessageThread
  unreadCount: number
  isActive: boolean
  onOpen: () => void
}) {
  const lastMessage = getLecturerThreadLastMessage(thread)
  const participantNames = getLecturerThreadOtherParticipants(thread)
    .map((participant) => participant.name)
    .join(", ")

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
        isActive && "bg-muted/50"
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          {unreadCount > 0 ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-primary"
              aria-label="Unread conversation"
            />
          ) : null}
          <span className="line-clamp-1">{thread.subject}</span>
        </span>
        {unreadCount > 0 ? <UnreadBadge count={unreadCount} /> : null}
      </span>
      <span className="line-clamp-1 text-xs text-muted-foreground">
        {participantNames}
      </span>
      {lastMessage ? (
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {lastMessage.senderId === LECTURER_MESSAGE_SENDER_ID ? "You: " : ""}
          {lastMessage.body}
        </span>
      ) : null}
      <span className="flex flex-wrap items-center gap-2">
        {lastMessage ? (
          <span className="text-[11px] text-muted-foreground">
            {formatShortDate(getLecturerThreadLastMessageAt(thread))}
          </span>
        ) : null}
        {thread.courseName ? (
          <Badge variant="outline" className="rounded-full font-normal">
            {thread.courseName}
          </Badge>
        ) : null}
      </span>
    </button>
  )
}

function ConversationHeader({
  thread,
  onBack,
}: {
  thread: LecturerMessageThread
  onBack: () => void
}) {
  const participantNames = getLecturerThreadOtherParticipants(thread)
    .map((participant) => participant.name)
    .join(", ")

  return (
    <div className="flex flex-col gap-2 border-b p-4 sm:p-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit md:hidden"
        onClick={onBack}
      >
        <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
        All conversations
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-base font-semibold">{thread.subject}</h2>
          <p className="text-xs text-muted-foreground">{participantNames}</p>
        </div>
        {thread.courseName ? (
          <Badge variant="outline" className="rounded-full">
            {thread.courseName}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  thread,
}: {
  message: LecturerThreadMessage
  thread: LecturerMessageThread
}) {
  const isOwn = message.senderId === LECTURER_MESSAGE_SENDER_ID
  const senderName = isOwn
    ? "You"
    : getLecturerParticipantName(thread, message.senderId)

  return (
    <div
      className={cn("flex flex-col gap-1", isOwn ? "items-end" : "items-start")}
    >
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{senderName}</span>
        <span>{formatDateTime(message.sentAt)}</span>
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line sm:max-w-[75%]",
          isOwn
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted"
        )}
      >
        {message.body}
      </div>
      {message.local ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
          <CheckCheckIcon className="size-3.5" aria-hidden="true" />
          Demo message — not delivered
        </span>
      ) : null}
    </div>
  )
}

function NewThreadDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: NewThreadInput) => void
}) {
  const [contactId, setContactId] = useState(
    () => lecturerMessageContacts[0]?.id ?? ""
  )
  const [courseId, setCourseId] = useState("none")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setContactId(lecturerMessageContacts[0]?.id ?? "")
    setCourseId("none")
    setSubject("")
    setBody("")
    setError(null)
  }

  function submit() {
    const contact = lecturerMessageContacts.find(
      (candidate) => candidate.id === contactId
    )

    if (!contact) {
      setError("Choose someone to message.")
      return
    }

    if (!subject.trim()) {
      setError("Add a subject so the recipient knows what this is about.")
      return
    }

    if (!body.trim()) {
      setError("Write a first message before starting the thread.")
      return
    }

    const courseName =
      courseId === "none"
        ? undefined
        : lecturerCourses.find((course) => course.id === courseId)?.name

    onCreate({
      contact,
      subject: subject.trim(),
      body: body.trim(),
      courseName,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">New message</DialogTitle>
          <DialogDescription>
            A local-only demo. Starting a thread does not send anything and no
            one is notified.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">To</span>
            <div
              role="radiogroup"
              aria-label="Choose a recipient"
              className="flex flex-col divide-y rounded-lg border"
            >
              {lecturerMessageContacts.map((contact) => (
                <label
                  key={contact.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 p-3 text-sm transition-colors hover:bg-muted/40",
                    contactId === contact.id && "bg-muted/40"
                  )}
                >
                  <input
                    type="radio"
                    name="new-thread-contact"
                    className="size-4 shrink-0 accent-primary"
                    checked={contactId === contact.id}
                    onChange={() => setContactId(contact.id)}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{contact.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {contact.role}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Curated contacts only. There is no student directory or
              cross-student browsing.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-thread-course">Course context</Label>
            <Select
              items={[
                { value: "none", label: "No course context" },
                ...lecturerCourses.map((course) => ({
                  value: course.id,
                  label: `${course.name} · ${course.branch}`,
                })),
              ]}
              value={courseId}
              onValueChange={(value) => setCourseId(value ?? "none")}
            >
              <SelectTrigger id="new-thread-course" className="w-full">
                <BookOpenIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No course context</SelectItem>
                {lecturerCourses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name} · {course.branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-thread-subject">Subject</Label>
            <Input
              id="new-thread-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What is this about?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-thread-body">Message</Label>
            <Textarea
              id="new-thread-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your message…"
              rows={4}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button onClick={submit}>Start demo thread</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
