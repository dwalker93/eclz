"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  InboxIcon,
  InfoIcon,
  MailIcon,
  MailOpenIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  XIcon,
} from "lucide-react"

import {
  StartThreadDialog,
  type StartThreadInput,
} from "@/components/messages/start-thread-dialog"
import {
  CURRENT_USER_ID,
  MOCK_NOW,
  formatMessageDayHeading,
  formatMessageListTime,
  formatMessageTime,
  getMessageParticipant,
  getMessageParticipantInitials,
  getMessageParticipantName,
  getThreadCourse,
  getThreadLastActivity,
  getThreadLastMessage,
  getThreadOtherParticipants,
  getThreadParticipantSummary,
  getThreadUnreadCount,
  groupMessagesByDay,
  isThreadUnread,
  messageThreads,
  type MessageRecord,
  type MessageThreadRecord,
} from "@/lib/messages-data"

export function MessageCenter() {
  const [threads, setThreads] = useState<MessageThreadRecord[]>(messageThreads)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [draft, setDraft] = useState("")
  const [toast, setToast] = useState<string | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const messageListRef = useRef<HTMLDivElement>(null)
  const localSeq = useRef(0)

  const sortedThreads = useMemo(
    () =>
      [...threads].sort((a, b) =>
        getThreadLastActivity(b).localeCompare(getThreadLastActivity(a))
      ),
    [threads]
  )

  const unreadThreadCount = threads.filter(isThreadUnread).length

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase()

    return sortedThreads.filter((thread) => {
      if (unreadOnly && !isThreadUnread(thread)) return false
      if (query.length === 0) return true

      const course = getThreadCourse(thread)
      const lastMessage = getThreadLastMessage(thread)

      return [
        thread.subject,
        getThreadParticipantSummary(thread),
        course?.name ?? "",
        lastMessage?.body ?? "",
        ...getThreadOtherParticipants(thread).map(
          (participant) => `${participant.fullName} ${participant.detail}`
        ),
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [search, sortedThreads, unreadOnly])

  const selectedThread =
    threads.find((thread) => thread.id === selectedId) ?? null
  const selectedMessages = selectedThread?.messages ?? []
  const selectedMessageCount = selectedMessages.length

  useEffect(() => {
    const list = messageListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [selectedId, selectedMessageCount])

  function openThread(thread: MessageThreadRecord) {
    setSelectedId(thread.id)
    setMobileThreadOpen(true)
    setDraft("")
    setThreads((previous) =>
      previous.map((item) =>
        item.id === thread.id && getThreadUnreadCount(item) > 0
          ? { ...item, lastReadAt: MOCK_NOW }
          : item
      )
    )
  }

  function markThreadRead(thread: MessageThreadRecord) {
    setThreads((previous) =>
      previous.map((item) =>
        item.id === thread.id ? { ...item, lastReadAt: MOCK_NOW } : item
      )
    )
    setToast("Thread marked as read in local demo state.")
  }

  function markThreadUnread(thread: MessageThreadRecord) {
    setThreads((previous) =>
      previous.map((item) =>
        item.id === thread.id ? { ...item, lastReadAt: null } : item
      )
    )
    setToast(
      "Thread marked unread in local demo state. No notification was sent."
    )
  }

  async function copyThreadReference(thread: MessageThreadRecord) {
    try {
      await navigator.clipboard.writeText(thread.id)
      setToast(`${thread.id} copied to the clipboard.`)
    } catch {
      setToast(`Thread reference: ${thread.id}`)
    }
  }

  function sendMessage() {
    const body = draft.trim()
    if (!body || !selectedThread) return

    const message: MessageRecord = {
      id: `msg-local-${++localSeq.current}`,
      senderId: CURRENT_USER_ID,
      body,
      sentAt: MOCK_NOW,
    }

    setThreads((previous) =>
      previous.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              messages: [...thread.messages, message],
              lastReadAt: MOCK_NOW,
            }
          : thread
      )
    )
    setDraft("")
    setToast(
      "Message added to the local demo conversation. Nothing was sent or delivered."
    )
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      sendMessage()
    }
  }

  function createThread(input: StartThreadInput) {
    const now = MOCK_NOW
    const thread: MessageThreadRecord = {
      id: `thr-local-${++localSeq.current}`,
      subject: input.subject,
      courseId: input.courseId,
      createdBy: CURRENT_USER_ID,
      createdAt: now,
      participantIds: [CURRENT_USER_ID, ...input.participantIds],
      lastReadAt: now,
      messages: input.body
        ? [
            {
              id: `msg-local-${++localSeq.current}`,
              senderId: CURRENT_USER_ID,
              body: input.body,
              sentAt: now,
            },
          ]
        : [],
    }

    setThreads((previous) => [thread, ...previous])
    setSelectedId(thread.id)
    setMobileThreadOpen(true)
    setDraft("")
    setSearch("")
    setUnreadOnly(false)
    setToast(
      `Thread “${thread.subject}” started in local demo state. No one was notified and nothing was delivered.`
    )
  }

  function clearFilters() {
    setSearch("")
    setUnreadOnly(false)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Threaded conversations with students, guardians, lecturers and
              staff. Unread state is based on your last-read time. Sample data —
              messages you add stay in this browser session and are never
              delivered.
            </p>
          </div>
          <Button onClick={() => setStartOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            New thread
          </Button>
        </div>

        {toast ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{toast}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setToast(null)}
              aria-label="Dismiss message"
            >
              <XIcon />
            </Button>
          </div>
        ) : null}

        <Card className="gap-0 overflow-hidden py-0 lg:h-[calc(100dvh-12.5rem)] lg:min-h-[560px]">
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div
              className={cn(
                "flex min-h-0 flex-col border-b lg:border-r lg:border-b-0",
                mobileThreadOpen && "hidden lg:flex"
              )}
            >
              <div className="flex flex-col gap-2.5 border-b px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Inbox</h2>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MailIcon className="size-3.5" aria-hidden="true" />
                    {unreadThreadCount} unread
                  </span>
                </div>

                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search threads"
                    aria-label="Search threads"
                    className="pl-8"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant={unreadOnly ? "ghost" : "secondary"}
                    size="sm"
                    onClick={() => setUnreadOnly(false)}
                    aria-pressed={!unreadOnly}
                  >
                    All threads
                    <Badge
                      variant="outline"
                      className="ml-1 rounded-full px-1.5 text-[10px] text-muted-foreground"
                    >
                      {threads.length}
                    </Badge>
                  </Button>
                  <Button
                    variant={unreadOnly ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setUnreadOnly(true)}
                    aria-pressed={unreadOnly}
                  >
                    Unread
                    <Badge
                      variant="outline"
                      className="ml-1 rounded-full px-1.5 text-[10px] text-muted-foreground"
                    >
                      {unreadThreadCount}                    </Badge>
                  </Button>
                </div>
              </div>

              <div className="max-h-[60dvh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
                {filteredThreads.length > 0 ? (
                  filteredThreads.map((thread) => {
                    const unreadCount = getThreadUnreadCount(thread)
                    const participants = getThreadOtherParticipants(thread)
                    const firstParticipant = participants[0]
                    const lastMessage = getThreadLastMessage(thread)
                    const course = getThreadCourse(thread)
                    const isSelected = thread.id === selectedId
                    const preview = lastMessage
                      ? `${
                          lastMessage.senderId === CURRENT_USER_ID
                            ? "You"
                            : getMessageParticipantName(
                                lastMessage.senderId
                              ).split(" ")[0]
                        }: ${lastMessage.body}`
                      : "No messages yet"

                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => openThread(thread)}
                        aria-current={isSelected ? "true" : undefined}
                        className={cn(
                          "relative flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
                          isSelected && "bg-muted/60",
                          isSelected &&
                            "after:absolute after:inset-y-0 after:left-0 after:w-0.5 after:bg-primary"
                        )}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="size-9">
                            <AvatarFallback className="text-xs">
                              {firstParticipant
                                ? getMessageParticipantInitials(
                                    firstParticipant.id
                                  )
                                : "?"}
                            </AvatarFallback>
                          </Avatar>
                          {unreadCount > 0 ? (
                            <span
                              className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "truncate text-sm",
                                unreadCount > 0
                                  ? "font-semibold"
                                  : "font-medium"
                              )}
                            >
                              {thread.subject}
                              {unreadCount > 0 ? (
                                <span className="sr-only">
                                  {" "}
                                  — {unreadCount} unread
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {formatMessageListTime(
                                getThreadLastActivity(thread)
                              )}
                            </span>
                          </div>

                          <span className="truncate text-xs text-muted-foreground">
                            {getThreadParticipantSummary(thread)}
                          </span>

                          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                            {course ? (
                              <Badge
                                variant="outline"
                                className="max-w-[9rem] shrink-0 gap-1 rounded-full px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                              >
                                <BookOpenIcon
                                  className="size-2.5"
                                  aria-hidden="true"
                                />
                                <span className="truncate">{course.name}</span>
                              </Badge>
                            ) : null}
                            <span className="truncate text-xs text-muted-foreground">
                              {preview}
                            </span>
                          </div>
                        </div>

                        {unreadCount > 0 ? (
                          <Badge className="mt-0.5 min-w-5 shrink-0 justify-center rounded-full px-1.5 text-[10px]">
                            {unreadCount}
                          </Badge>
                        ) : null}
                      </button>
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <SearchIcon className="size-5" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium">No threads match</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Try a different name, subject or filter.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div
              className={cn(
                "flex min-h-0 flex-col",
                !mobileThreadOpen && "hidden lg:flex"
              )}
            >
              {selectedThread ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="lg:hidden"
                        onClick={() => setMobileThreadOpen(false)}
                        aria-label="Back to inbox"
                      >
                        <ArrowLeftIcon />
                      </Button>
                      <Avatar className="mt-0.5 hidden size-9 sm:flex">
                        <AvatarFallback className="text-xs">
                          {getMessageParticipantInitials(
                            getThreadOtherParticipants(selectedThread)[0]?.id ??
                              CURRENT_USER_ID
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <h2 className="truncate text-sm font-semibold sm:text-base">
                          {selectedThread.subject}
                        </h2>
                        <p className="truncate text-xs text-muted-foreground">
                          {getThreadParticipantSummary(selectedThread)} ·{" "}
                          {selectedThread.participantIds.length} participants
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {getThreadCourse(selectedThread) ? (
                            <Badge
                              variant="outline"
                              className="max-w-[16rem] gap-1 rounded-full text-[10px] font-normal text-muted-foreground"
                            >
                              <BookOpenIcon
                                className="size-2.5"
                                aria-hidden="true"
                              />
                              <span className="truncate">
                                {getThreadCourse(selectedThread)?.name}
                              </span>
                            </Badge>
                          ) : null}
                          {isThreadUnread(selectedThread) ? (
                            <Badge
                              variant="outline"
                              className="rounded-full text-[10px] font-normal"
                            >
                              {getThreadUnreadCount(selectedThread)} unread
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="hidden -space-x-2 sm:flex">
                        {getThreadOtherParticipants(selectedThread)
                          .slice(0, 3)
                          .map((participant) => (
                            <Avatar
                              key={participant.id}
                              className="size-7 ring-2 ring-card"
                              title={`${participant.fullName} · ${participant.role}`}
                            >
                              <AvatarFallback className="text-[10px]">
                                {getMessageParticipantInitials(participant.id)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${selectedThread.subject}`}
                            />
                          }
                        >
                          <EllipsisVerticalIcon
                            className="size-4"
                            aria-hidden="true"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>
                              {selectedThread.id}
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => markThreadRead(selectedThread)}
                            >
                              <MailOpenIcon aria-hidden="true" />
                              Mark as read
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => markThreadUnread(selectedThread)}
                            >
                              <MailIcon aria-hidden="true" />
                              Mark as unread
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                copyThreadReference(selectedThread)
                              }
                            >
                              <CopyIcon aria-hidden="true" />
                              Copy thread reference
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              setToast(
                                "Participants and read state are read-only in this demo."
                              )
                            }
                          >
                            <InfoIcon aria-hidden="true" />
                            Participant settings (demo)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div
                    ref={messageListRef}
                    className="max-h-[55dvh] min-h-0 flex-1 overflow-y-auto bg-muted/10 px-4 py-5 sm:px-6 lg:max-h-none"
                  >
                    {selectedMessages.length > 0 ? (
                      <div className="flex flex-col gap-6">
                        {groupMessagesByDay(selectedMessages).map((group) => (
                          <div
                            key={group.date}
                            className="flex flex-col gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <Separator className="flex-1" />
                              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                {formatMessageDayHeading(group.date)}
                              </span>
                              <Separator className="flex-1" />
                            </div>

                            {group.messages.map((message) => {
                              const own =
                                message.senderId === CURRENT_USER_ID
                              const sender = getMessageParticipant(
                                message.senderId
                              )

                              return (
                                <div
                                  key={message.id}
                                  className={cn(
                                    "flex max-w-[92%] flex-col gap-1 sm:max-w-[85%]",
                                    own
                                      ? "ml-auto items-end"
                                      : "mr-auto items-start"
                                  )}
                                >
                                  {!own ? (
                                    <div className="flex items-center gap-1.5">
                                      <Avatar className="size-5">
                                        <AvatarFallback className="text-[9px]">
                                          {getMessageParticipantInitials(
                                            message.senderId
                                          )}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs font-medium">
                                        {sender?.fullName ??
                                          "Unknown participant"}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground">
                                        {sender?.role ?? "Participant"}
                                      </span>
                                    </div>
                                  ) : null}
                                  <div
                                    className={cn(
                                      "rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line",
                                      own
                                        ? "rounded-br-sm bg-primary text-primary-foreground"
                                        : "rounded-bl-sm border bg-card"
                                    )}
                                  >
                                    {message.body}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">
                                    {own ? "You · " : ""}
                                    {formatMessageTime(message.sentAt)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center">
                        <MessageSquareIcon
                          className="size-5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-medium">No messages yet</p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                          Write the first message below to start this local demo
                          conversation.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-t px-4 py-3 sm:px-5">
                    <div className="flex flex-col gap-2">
                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        rows={2}
                        placeholder={`Reply to ${getThreadParticipantSummary(selectedThread)}…`}
                        aria-label="Message body"
                        className="min-h-[68px] resize-none"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <InfoIcon
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          Demo only — replies stay in this browser session.
                          Enter sends, Shift+Enter adds a line.
                        </p>
                        <Button
                          onClick={sendMessage}
                          disabled={!draft.trim()}
                        >
                          <SendIcon data-icon="inline-start" />
                          Send (demo)
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <InboxIcon className="size-6" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold">
                      Select a conversation
                    </p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Choose a thread from the inbox to read the history and
                      reply. New threads can include students, guardians,
                      lecturers and staff.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
          <InfoIcon
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            Threads combine a subject, participants and an optional course.
            Unread state compares your last-read time with the latest incoming
            message. This demo never sends messages, emails, SMS or push
            notifications.
          </span>
        </div>
      </div>

      <StartThreadDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        onCreate={createThread}
      />
    </main>
  )
}
