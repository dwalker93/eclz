"use client"

import { useEffect, useRef, useState } from "react"

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
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  InfoIcon,
  MessagesSquareIcon,
  SearchXIcon,
  SendIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import { UnreadBadge } from "@/components/portal-status-badge"
import {
  getParentParticipantName,
  getParentThreadLastMessage,
  getParentThreadLastMessageAt,
  getParentThreadOtherParticipants,
  getParentThreadUnreadCount,
  parent,
  parentMessageContacts,
  parentMessageThreads,
  PARENT_MESSAGE_SENDER_ID,
  type ParentChild,
  type ParentMessageThread,
} from "@/lib/parent-portal-data"
import {
  formatDateTime,
  formatDisplayDate,
  formatShortDate,
  MOCK_NOW,
  MOCK_TODAY,
  type MessageParticipant,
  type ThreadMessage,
} from "@/lib/student-portal-data"

type MobileView = "list" | "conversation"

function childName(childId: string | undefined, children: ParentChild[]) {
  if (!childId) return null

  return children.find((child) => child.id === childId)?.preferredName ?? null
}

export function ParentMessages() {
  const { children: linkedChildren, selectedChild } = useParentChild()
  const [threads, setThreads] = useState<ParentMessageThread[]>(
    () => parentMessageThreads
  )
  const [readAtMap, setReadAtMap] = useState<Record<string, string>>({})
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>("list")
  const [search, setSearch] = useState("")
  const [composerText, setComposerText] = useState("")
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const didMount = useRef(false)

  // The header selector changes the child without remounting this page. The
  // conversation list re-scopes itself, so the mobile view, search and composer
  // reset when the child changes; a selected guardian-level thread stays open.
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }

    setMobileView("list")
    setSearch("")
    setComposerText("")
  }, [selectedChild?.id])

  // Guardian-level threads (no child) apply to every child; child threads appear
  // only for the child they concern.
  const scopedThreads = threads.filter(
    (thread) => !thread.childId || thread.childId === selectedChild?.id
  )

  const sortedThreads = [...scopedThreads].sort((a, b) =>
    getParentThreadLastMessageAt(b).localeCompare(
      getParentThreadLastMessageAt(a)
    )
  )

  const filteredThreads = sortedThreads.filter((thread) => {
    const query = search.trim().toLowerCase()

    if (!query) return true

    const participantNames = getParentThreadOtherParticipants(thread)
      .map((participant) => participant.name)
      .join(" ")
      .toLowerCase()

    return (
      thread.subject.toLowerCase().includes(query) ||
      participantNames.includes(query) ||
      (thread.courseName?.toLowerCase().includes(query) ?? false)
    )
  })

  const totalUnread = scopedThreads.reduce(
    (total, thread) =>
      total + getParentThreadUnreadCount(thread, readAtMap[thread.id]),
    0
  )

  const activeThread =
    sortedThreads.find((thread) => thread.id === activeThreadId) ??
    sortedThreads[0] ??
    null

  function openThread(threadId: string) {
    setActiveThreadId(threadId)
    setMobileView("conversation")
    setReadAtMap((current) => ({ ...current, [threadId]: MOCK_NOW }))
  }

  function sendMessage() {
    const body = composerText.trim()
    const threadId = activeThread?.id

    if (!body || !threadId) return

    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              messages: [
                ...thread.messages,
                {
                  id: `${thread.id}-local-${thread.messages.length + 1}`,
                  senderId: PARENT_MESSAGE_SENDER_ID,
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
  }: {
    contact: MessageParticipant
    subject: string
    body: string
  }) {
    const threadId = `parent-local-thread-${contact.id}`

    const newThread: ParentMessageThread = {
      id: threadId,
      subject,
      childId: selectedChild?.id,
      participants: [
        {
          id: PARENT_MESSAGE_SENDER_ID,
          name: parent.fullName,
          role: "Guardian",
        },
        contact,
      ],
      lastReadAt: MOCK_NOW,
      messages: [
        {
          id: `${threadId}-local-1`,
          senderId: PARENT_MESSAGE_SENDER_ID,
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
          description={
            selectedChild
              ? `Conversations you take part in for ${selectedChild.preferredName}, and guardian-wide threads. Sample messages only — anything you type stays on this page and is never sent.`
              : "Conversations you take part in as a guardian. Sample messages only — anything you type stays on this page and is never sent."
          }
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {linkedChildren.length} linked{" "}
                {linkedChildren.length === 1 ? "child" : "children"}
              </Badge>
              {selectedChild ? (
                <Badge variant="outline" className="rounded-full">
                  Viewing {selectedChild.preferredName}
                </Badge>
              ) : null}
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
              <Button
                size="sm"
                onClick={() => setNewThreadOpen(true)}
                disabled={!selectedChild}
              >
                <MessagesSquareIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                New message
              </Button>
            </div>
          }
        />

        {!selectedChild ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No linked children"
              description="No student is linked to this guardian record, so there are no child messages to show. Contact the branch office if a child is missing from your account."
            />
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <UserRoundIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {parent.fullName}
              </span>
              <span className="text-muted-foreground">
                Guardian · {parent.contactEmail}
              </span>
              <span className="text-muted-foreground">
                Viewing {selectedChild.fullName} · {selectedChild.grade} ·{" "}
                {selectedChild.branch} branch
              </span>
              <Badge
                variant="outline"
                className="gap-1.5 rounded-full sm:ml-auto"
              >
                <ShieldCheckIcon aria-hidden="true" />
                Local demo only
              </Badge>
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
                    <Label htmlFor="parent-message-search" className="sr-only">
                      Search conversations
                    </Label>
                    <Input
                      id="parent-message-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search subject, person or course"
                      type="search"
                    />
                  </div>
                  {filteredThreads.length === 0 ? (
                    <EmptyState
                      icon={
                        <SearchXIcon className="size-5" aria-hidden="true" />
                      }
                      title="No conversations found"
                      description={`Try a different search, or start a new message about ${selectedChild.preferredName}.`}
                    />
                  ) : (
                    <ul className="flex flex-col divide-y md:h-[32rem] md:overflow-y-auto">
                      {filteredThreads.map((thread) => (
                        <li key={thread.id}>
                          <ThreadListItem
                            thread={thread}
                            children={linkedChildren}
                            unreadCount={getParentThreadUnreadCount(
                              thread,
                              readAtMap[thread.id]
                            )}
                            isActive={thread.id === activeThread?.id}
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
                        children={linkedChildren}
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
                          htmlFor="parent-message-composer"
                          className="sr-only"
                        >
                          Write a message
                        </Label>
                        <Textarea
                          id="parent-message-composer"
                          value={composerText}
                          onChange={(event) =>
                            setComposerText(event.target.value)
                          }
                          placeholder="Write a local demo message..."
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
                            <SendIcon
                              data-icon="inline-start"
                              aria-hidden="true"
                            />
                            Add to thread
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      icon={
                        <MessagesSquareIcon
                          className="size-5"
                          aria-hidden="true"
                        />
                      }
                      title="Select a conversation"
                      description={`Choose a conversation about ${selectedChild.preferredName}, or start a new message to a lecturer or the branch office.`}
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
                  This page uses local sample data. You only see conversations
                  your guardian record is part of — no other family's threads
                  and no conversations with unrelated students are shown.
                  Guardian threads apply to both children; child threads are
                  tagged with the child they concern. Composing or starting a
                  thread does not send anything: messages you add stay in this
                  preview and are marked as not delivered.
                </p>
              </CardContent>
            </Card>
          </>
        )}
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
  children,
  unreadCount,
  isActive,
  onOpen,
}: {
  thread: ParentMessageThread
  children: ParentChild[]
  unreadCount: number
  isActive: boolean
  onOpen: () => void
}) {
  const lastMessage = getParentThreadLastMessage(thread)
  const participantNames = getParentThreadOtherParticipants(thread)
    .map((participant) => participant.name)
    .join(", ")
  const about = childName(thread.childId, children)

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
          {lastMessage.senderId === PARENT_MESSAGE_SENDER_ID ? "You: " : ""}
          {lastMessage.body}
        </span>
      ) : null}
      <span className="flex flex-wrap items-center gap-2">
        {lastMessage ? (
          <span className="text-[11px] text-muted-foreground">
            {formatShortDate(getParentThreadLastMessageAt(thread))}
          </span>
        ) : null}
        {about ? (
          <Badge variant="outline" className="gap-1 rounded-full font-normal">
            <UserRoundIcon aria-hidden="true" />
            {about}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 rounded-full font-normal text-muted-foreground"
          >
            <UsersRoundIcon aria-hidden="true" />
            All children
          </Badge>
        )}
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
  children,
  onBack,
}: {
  thread: ParentMessageThread
  children: ParentChild[]
  onBack: () => void
}) {
  const participantNames = getParentThreadOtherParticipants(thread)
    .map((participant) => participant.name)
    .join(", ")
  const about = childName(thread.childId, children)

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
        <div className="flex flex-wrap items-center gap-2">
          {about ? (
            <Badge variant="outline" className="gap-1 rounded-full">
              <UserRoundIcon aria-hidden="true" />
              {about}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 rounded-full text-muted-foreground"
            >
              <UsersRoundIcon aria-hidden="true" />
              Guardian thread
            </Badge>
          )}
          {thread.courseName ? (
            <Badge variant="outline" className="rounded-full">
              {thread.courseName}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  thread,
}: {
  message: ThreadMessage
  thread: ParentMessageThread
}) {
  const isOwn = message.senderId === PARENT_MESSAGE_SENDER_ID
  const senderName = isOwn
    ? "You"
    : getParentParticipantName(thread, message.senderId)

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
  onCreate: (input: {
    contact: MessageParticipant
    subject: string
    body: string
  }) => void
}) {
  const [contactId, setContactId] = useState(
    () => parentMessageContacts[0]?.id ?? ""
  )
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setContactId(parentMessageContacts[0]?.id ?? "")
    setSubject("")
    setBody("")
    setError(null)
  }

  function submit() {
    const contact = parentMessageContacts.find(
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

    onCreate({ contact, subject: subject.trim(), body: body.trim() })
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
            one is notified. The thread is filed under the child selected in the
            header.
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
              {parentMessageContacts.map((contact) => (
                <label
                  key={contact.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 p-3 text-sm transition-colors hover:bg-muted/40",
                    contactId === contact.id && "bg-muted/40"
                  )}
                >
                  <input
                    type="radio"
                    name="new-parent-thread-contact"
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
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="new-parent-thread-subject"
              className="text-sm font-medium"
            >
              Subject
            </Label>
            <Input
              id="new-parent-thread-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What is this about?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="new-parent-thread-body"
              className="text-sm font-medium"
            >
              Message
            </Label>
            <Textarea
              id="new-parent-thread-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your message..."
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
