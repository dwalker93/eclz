"use client"

import { useEffect, useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  InfoIcon,
  MessageSquareIcon,
  SearchIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react"

import {
  CURRENT_USER_ID,
  getMessageParticipantInitials,
  messageCourseOptions,
  messageParticipants,
  messageRoleFilterOptions,
  type MessageParticipant,
} from "@/lib/messages-data"

export type StartThreadInput = {
  subject: string
  courseId: string | null
  participantIds: string[]
  body: string
}

type StartThreadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: StartThreadInput) => void
}

const courseItems = [
  { value: "none", label: "No course" },
  ...messageCourseOptions,
]

export function StartThreadDialog({
  open,
  onOpenChange,
  onCreate,
}: StartThreadDialogProps) {
  const [subject, setSubject] = useState("")
  const [courseId, setCourseId] = useState("none")
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [roleFilter, setRoleFilter] = useState("all")
  const [participantSearch, setParticipantSearch] = useState("")
  const [body, setBody] = useState("")
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!open) return

    setSubject("")
    setCourseId("none")
    setParticipantIds([])
    setRoleFilter("all")
    setParticipantSearch("")
    setBody("")
    setErrors([])
  }, [open])

  const availableParticipants = useMemo(() => {
    const query = participantSearch.trim().toLowerCase()

    return messageParticipants
      .filter((participant) => participant.id !== CURRENT_USER_ID)
      .filter(
        (participant) =>
          roleFilter === "all" || participant.role === roleFilter
      )
      .filter(
        (participant) =>
          query.length === 0 ||
          participant.fullName.toLowerCase().includes(query) ||
          participant.detail.toLowerCase().includes(query)
      )
  }, [participantSearch, roleFilter])

  const selectedParticipants = participantIds
    .map((id) => messageParticipants.find((participant) => participant.id === id))
    .filter((participant): participant is MessageParticipant =>
      Boolean(participant)
    )

  function toggleParticipant(id: string, checked: boolean) {
    setParticipantIds((previous) =>
      checked
        ? previous.includes(id)
          ? previous
          : [...previous, id]
        : previous.filter((participantId) => participantId !== id)
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: string[] = []

    if (!subject.trim()) nextErrors.push("Subject is required.")
    if (participantIds.length === 0) {
      nextErrors.push("Select at least one participant.")
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors([])
    onCreate({
      subject: subject.trim(),
      courseId: courseId === "none" ? null : courseId,
      participantIds,
      body: body.trim(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareIcon className="size-4" aria-hidden="true" />
            Start a thread
          </DialogTitle>
          <DialogDescription>
            Choose who should be in the conversation, add an optional course
            context, and write the first message. This is a UI demo — no
            invitations or notifications are sent.
          </DialogDescription>
        </DialogHeader>

        <form
          id="start-thread-form"
          className="flex flex-col gap-5"
          onSubmit={handleSubmit}
          noValidate
        >
          {errors.length > 0 ? (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {errors.map((error) => (
                <span key={error}>{error}</span>
              ))}
            </div>
          ) : null}

          <Field
            label="Subject"
            htmlFor="thread-subject"
            required
            hint="Keep it short so the thread is easy to find in the inbox."
          >
            <Input
              id="thread-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Grade 11 revision timetable"
            />
          </Field>

          <Field
            label="Course context"
            htmlFor="thread-course"
            hint="Optional. Link the thread to one course."
          >
            <Select
              items={courseItems}
              value={courseId}
              onValueChange={(value) => setCourseId(value ?? "none")}
            >
              <SelectTrigger id="thread-course" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No course</SelectItem>
                {messageCourseOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>
                Participants
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <span className="text-xs text-muted-foreground">
                {participantIds.length}{" "}
                {participantIds.length === 1 ? "participant" : "participants"}{" "}
                selected
              </span>
            </div>

            {selectedParticipants.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedParticipants.map((participant) => (
                  <Button
                    key={participant.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 rounded-full pr-1.5 pl-2.5"
                    onClick={() => toggleParticipant(participant.id, false)}
                  >
                    {participant.fullName}
                    <XIcon className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">
                      Remove {participant.fullName}
                    </span>
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)]">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={participantSearch}
                  onChange={(event) =>
                    setParticipantSearch(event.target.value)
                  }
                  placeholder="Search students, guardians, lecturers or staff"
                  aria-label="Search participants"
                  className="pl-8"
                />
              </div>

              <Select
                items={messageRoleFilterOptions}
                value={roleFilter}
                onValueChange={(value) => setRoleFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {messageRoleFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border">
              {availableParticipants.length > 0 ? (
                <div className="flex flex-col divide-y">
                  {availableParticipants.map((participant) => {
                    const checked = participantIds.includes(participant.id)

                    return (
                      <label
                        key={participant.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60",
                          checked && "bg-muted/40"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleParticipant(participant.id, Boolean(value))
                          }
                        />
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {getMessageParticipantInitials(participant.id)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">
                            {participant.fullName}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {participant.detail}
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 rounded-full text-muted-foreground"
                        >
                          {participant.role}
                        </Badge>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <UsersRoundIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">
                    No participants match
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Try another name or choose a different role.
                  </p>
                </div>
              )}
            </div>
          </section>

          <Field
            label="First message"
            htmlFor="thread-first-message"
            hint="Optional. You can also send the first message from the thread."
          >
            <Textarea
              id="thread-first-message"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              placeholder="Write a short opening message."
            />
          </Field>

          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <InfoIcon
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              Demo only: the thread exists in this browser session. No message,
              invitation or notification is delivered to anyone.
            </span>
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="start-thread-form">
            <MessageSquareIcon data-icon="inline-start" />
            Start thread (demo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        <span>
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
