"use client"

import { useRef } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  BookOpenIcon,
  CalendarClockIcon,
  InfoIcon,
  MapPinIcon,
  PencilIcon,
} from "lucide-react"

import {
  courseKindLabels,
  deliveryModeLabels,
  formatTimeValue,
  learningModeLabels,
} from "@/lib/courses-data"
import type { TimetableSlotRecord } from "@/lib/timetable-data"

type SlotDetailSheetProps = {
  slot: TimetableSlotRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (slot: TimetableSlotRecord) => void
}

export function SlotDetailSheet({
  slot,
  open,
  onOpenChange,
  onEdit,
}: SlotDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        {slot ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {slot.course.name}
                <Badge variant="outline" className="rounded-full">
                  {courseKindLabels[slot.course.kind]}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {slot.weekdayName} · {formatTimeValue(slot.startsAt)} –{" "}
                {formatTimeValue(slot.endsAt)} · {slot.branchName}
                {slot.room ? ` · Room ${slot.room}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CalendarClockIcon />}
                  title="Recurring slot"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <ProfileField label="Course" value={slot.course.name} />
                  <ProfileField
                    label="Kind"
                    value={courseKindLabels[slot.course.kind]}
                  />
                  <ProfileField label="Subject" value={slot.subjectName} />
                  <ProfileField label="Branch" value={slot.branchName} />
                  <ProfileField
                    label="Grades"
                    value={
                      slot.gradeNames.length > 0
                        ? slot.gradeNames.join(", ")
                        : "No grade link"
                    }
                  />
                  <ProfileField
                    label="Delivery"
                    value={deliveryModeLabels[slot.deliveryMode]}
                  />
                  <ProfileField
                    label="Learning mode"
                    value={learningModeLabels[slot.course.learningMode]}
                  />
                  <ProfileField
                    label="Attendance"
                    value={
                      slot.course.attendanceEnabled
                        ? "Enabled (scheduled)"
                        : "Not enabled"
                    }
                  />
                  <ProfileField
                    label="Teacher"
                    value={
                      slot.lecturerNames.length > 0
                        ? slot.lecturerNames.join(", ")
                        : "No teacher assigned"
                    }
                  />
                  <ProfileField label="Day" value={slot.weekdayName} />
                  <ProfileField
                    label="Time"
                    value={`${formatTimeValue(slot.startsAt)} – ${formatTimeValue(slot.endsAt)}`}
                  />
                  <ProfileField
                    label="Room"
                    value={slot.room ? slot.room : "Not set"}
                  />
                </dl>
              </section>

              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Weekly slots are recurring templates. They are not dated class
                  sessions and do not mark attendance. Room capacity and
                  conflict checks are not modelled on this page.
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPinIcon className="size-3.5" aria-hidden="true" />
                <span>
                  {slot.branchName}
                  {slot.room ? ` · Room ${slot.room}` : " · Room not set"}
                </span>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="text-xs text-muted-foreground">
                Sample recurring slot · no changes are saved
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={() => onEdit(slot)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit slot (demo)
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
      {title}
    </h3>
  )
}

function ProfileField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}
