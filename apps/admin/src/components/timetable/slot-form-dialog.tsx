"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"

import { Button } from "@workspace/ui/components/button"
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
import {
  CalendarClockIcon,
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
} from "lucide-react"

import { getWeekdayName } from "@/lib/courses-data"
import {
  timetableCourseFormOptions,
  timetableWeekdays,
  type TimetableSlotRecord,
} from "@/lib/timetable-data"

type SlotFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this recurring slot; otherwise it creates one. */
  slot?: TimetableSlotRecord | null
  onSaved: (message: string) => void
}

type FormState = {
  courseId: string
  weekday: string
  startsAt: string
  endsAt: string
  room: string
}

type FormErrors = {
  courseId?: string
  startsAt?: string
  endsAt?: string
}

function createEmptyForm(slot?: TimetableSlotRecord | null): FormState {
  return {
    courseId: slot?.course.id ?? "",
    weekday: slot ? String(slot.weekday) : "1",
    startsAt: slot?.startsAt ?? "16:00",
    endsAt: slot?.endsAt ?? "18:00",
    room: slot?.room ?? "",
  }
}

export function SlotFormDialog({
  open,
  onOpenChange,
  slot,
  onSaved,
}: SlotFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => createEmptyForm(slot))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(slot)

  useEffect(() => {
    setForm(createEmptyForm(slot))
    setErrors({})
    setSubmitted(false)
  }, [open, slot])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}

    if (!isEdit && !form.courseId) {
      nextErrors.courseId = "Select the course or class for this slot."
    }

    if (!form.startsAt) {
      nextErrors.startsAt = "Start time is required."
    }

    if (!form.endsAt) {
      nextErrors.endsAt = "End time is required."
    }

    if (form.startsAt && form.endsAt && form.endsAt <= form.startsAt) {
      nextErrors.endsAt = "End time must be after the start time."
    }

    return nextErrors
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validate()

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitted(true)
  }

  const courseLabel = isEdit
    ? (slot?.course.name ?? "")
    : (timetableCourseFormOptions.find(
        (option) => option.value === form.courseId
      )?.label ?? "")
  const weekdayLabel = getWeekdayName(Number(form.weekday))
  const trimmedRoom = form.room.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClockIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit recurring slot" : "Add recurring slot"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this weekly slot. This is a UI preview — no slot is changed."
              : "Add a weekly slot to a class or scheduled program. This is a UI preview — no slot is saved."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col gap-4" role="status">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
              <CheckIcon
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {isEdit ? "Slot update ready" : "Slot ready to add"}
                </span>
                <p className="text-sm">
                  {isEdit
                    ? `The ${weekdayLabel} slot for “${courseLabel}” would be updated.`
                    : `A ${weekdayLabel} slot would be added to “${courseLabel}”.`}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Course
                </dt>
                <dd className="truncate text-sm" title={courseLabel}>
                  {courseLabel}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Day and time
                </dt>
                <dd className="text-sm">
                  {weekdayLabel} · {form.startsAt} – {form.endsAt}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Room
                </dt>
                <dd className="text-sm">
                  {trimmedRoom ? trimmedRoom : "Not set"}
                </dd>
              </div>
            </dl>

            <ul className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                The slot repeats every {weekdayLabel}.
              </li>
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Weekly slots are templates; they are not dated sessions or
                attendance records.
              </li>
            </ul>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This is a demo preview only. No recurring slot is created or
                updated.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="slot-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slot-course">
                <span>
                  Course or class
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              {isEdit ? (
                <Input id="slot-course" value={courseLabel} readOnly disabled />
              ) : (
                <Select
                  items={timetableCourseFormOptions}
                  value={form.courseId || null}
                  onValueChange={(value) => update("courseId", value ?? "")}
                >
                  <SelectTrigger
                    id="slot-course"
                    className="w-full"
                    aria-invalid={errors.courseId ? true : undefined}
                    aria-describedby={
                      errors.courseId ? "slot-course-error" : undefined
                    }
                  >
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {timetableCourseFormOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.courseId ? (
                <p id="slot-course-error" className="text-xs text-destructive">
                  {errors.courseId}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Self-paced programs cannot have a weekly slot.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slot-weekday">
                  <span>
                    Day
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Select
                  items={timetableWeekdays.map((day) => ({
                    value: String(day.value),
                    label: day.label,
                  }))}
                  value={form.weekday}
                  onValueChange={(value) => update("weekday", value ?? "1")}
                >
                  <SelectTrigger id="slot-weekday" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timetableWeekdays.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slot-start">
                  <span>
                    Starts at
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="slot-start"
                  type="time"
                  value={form.startsAt}
                  onChange={(event) => update("startsAt", event.target.value)}
                  aria-invalid={errors.startsAt ? true : undefined}
                  aria-describedby={
                    errors.startsAt ? "slot-start-error" : undefined
                  }
                />
                {errors.startsAt ? (
                  <p id="slot-start-error" className="text-xs text-destructive">
                    {errors.startsAt}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slot-end">
                  <span>
                    Ends at
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="slot-end"
                  type="time"
                  value={form.endsAt}
                  onChange={(event) => update("endsAt", event.target.value)}
                  aria-invalid={errors.endsAt ? true : undefined}
                  aria-describedby={
                    errors.endsAt ? "slot-end-error" : undefined
                  }
                />
                {errors.endsAt ? (
                  <p id="slot-end-error" className="text-xs text-destructive">
                    {errors.endsAt}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slot-room">
                <span>
                  Room
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </span>
              </Label>
              <Input
                id="slot-room"
                value={form.room}
                onChange={(event) => update("room", event.target.value)}
                placeholder="e.g. C-201"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for an online slot. Room capacity is not stored.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                A repeating slot stores a weekday and start/end times only. It
                does not create sessions or an attendance register.
              </span>
            </div>
          </form>
        )}

        <DialogFooter className="gap-2">
          {submitted ? (
            <>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Back to form
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onSaved(
                    isEdit
                      ? `Slot update preview closed. The ${weekdayLabel} slot for “${courseLabel}” was not changed — this is a UI demo.`
                      : `Slot preview closed. A ${weekdayLabel} slot for “${courseLabel}” was not added — this is a UI demo.`
                  )
                }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="slot-form">
                {isEdit ? "Save slot (demo)" : "Add slot (demo)"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
