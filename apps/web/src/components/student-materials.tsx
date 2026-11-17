"use client"

import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  InfoIcon,
  LibraryBigIcon,
  LockKeyholeIcon,
  PlayIcon,
  ShoppingBagIcon,
  UserRoundIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  MaterialAccessBadge,
  MaterialEntitlementBadge,
  MaterialKindBadge,
} from "@/components/portal-status-badge"
import {
  formatDisplayDate,
  formatLkr,
  learningMaterials,
  portalModules,
  student,
  studentCourses,
  type LearningMaterial,
  type MaterialKind,
} from "@/lib/student-portal-data"

type PurchaseStep = "details" | "review" | "done"

const materialKindTones: Record<MaterialKind, string> = {
  recording: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  file: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  book: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

function groupMaterialsBySection(materials: LearningMaterial[]) {
  const grouped = new Map<string, LearningMaterial[]>()

  for (const material of materials) {
    const existing = grouped.get(material.section)

    if (existing) {
      existing.push(material)
    } else {
      grouped.set(material.section, [material])
    }
  }

  return Array.from(grouped, ([section, items]) => ({ section, items }))
}

export function StudentMaterials() {
  const storeEnabled = portalModules.contentStore
  const [previewMaterial, setPreviewMaterial] =
    useState<LearningMaterial | null>(null)
  const [purchaseMaterial, setPurchaseMaterial] =
    useState<LearningMaterial | null>(null)
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("details")

  const courseGroups = studentCourses
    .filter((course) => course.status === "active")
    .map((course) => {
      const materials = learningMaterials.filter(
        (material) => material.courseId === course.id
      )

      return {
        course,
        materials,
        sections: groupMaterialsBySection(materials),
      }
    })
    .filter((group) => group.materials.length > 0)

  const visibleMaterials = courseGroups.flatMap((group) => group.materials)
  const lockedCount = visibleMaterials.filter(
    (material) => material.entitlement === "locked"
  ).length

  function openPurchase(material: LearningMaterial) {
    setPurchaseMaterial(material)
    setPurchaseStep("details")
  }

  function handlePurchaseOpenChange(open: boolean) {
    if (!open) {
      setPurchaseMaterial(null)
      setPurchaseStep("details")
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Learning Materials"
          description="Recordings, files and physical books for your active courses. Previews and purchases are local-only and are not connected to storage, streaming or payments."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Student portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {student.grade} · {student.branch}
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <LibraryBigIcon aria-hidden="true" />
                {visibleMaterials.length} items
              </Badge>
              {storeEnabled ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 rounded-full border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400"
                >
                  <ShoppingBagIcon aria-hidden="true" />
                  Content store enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full">
                  Content store disabled
                </Badge>
              )}
            </div>
          }
        />

        {lockedCount > 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm sm:p-4">
            <LockKeyholeIcon
              className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">
                {lockedCount} paid {lockedCount === 1 ? "item is" : "items are"}{" "}
                locked
              </p>
              <p className="text-muted-foreground">
                {storeEnabled
                  ? "Open a locked item to preview the local purchase flow. No payment is taken and access stays locked in this demo."
                  : "Paid content is unavailable while the content store is disabled. Contact the institute office for access."}
              </p>
            </div>
          </div>
        ) : null}

        {courseGroups.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<LibraryBigIcon className="size-5" aria-hidden="true" />}
              title="No learning materials"
              description="Course materials will appear here when your lecturers publish them. Contact the institute office if you expected content."
            />
          </Card>
        ) : (
          courseGroups.map(({ course, materials, sections }) => (
            <Card key={course.id} className="gap-0 py-0">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    {course.subject.slice(0, 1)}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <CardTitle>{course.name}</CardTitle>
                    <CardDescription>
                      {course.subject} · {course.teachers.join(", ")} ·{" "}
                      {course.branch}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {materials.length} items
                </Badge>
              </CardHeader>

              <CardContent className="flex flex-col gap-6 p-4 sm:p-6">
                {sections.map(({ section, items }) => (
                  <section key={section} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{section}</h3>
                      <Badge variant="outline" className="rounded-full">
                        {items.length}
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {items.map((material) => (
                        <MaterialCard
                          key={material.id}
                          material={material}
                          storeEnabled={storeEnabled}
                          onPreview={() => setPreviewMaterial(material)}
                          onPurchase={() => openPurchase(material)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </CardContent>

              <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                Content is limited to this course and your current enrolment.
              </CardFooter>
            </Card>
          ))
        )}

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Open and download actions are local previews only. No files are
              downloaded, recordings are not streamed, and no storage keys are
              exposed. Paid items remain locked unless marked purchased.
            </p>
          </CardContent>
        </Card>
      </div>

      <MaterialPreviewDialog
        material={previewMaterial}
        onOpenChange={(open) => {
          if (!open) setPreviewMaterial(null)
        }}
      />

      <MaterialPurchaseDialog
        material={purchaseMaterial}
        step={purchaseStep}
        storeEnabled={storeEnabled}
        onStepChange={setPurchaseStep}
        onOpenChange={handlePurchaseOpenChange}
      />
    </main>
  )
}

function MaterialCard({
  material,
  storeEnabled,
  onPreview,
  onPurchase,
}: {
  material: LearningMaterial
  storeEnabled: boolean
  onPreview: () => void
  onPurchase: () => void
}) {
  const locked = material.entitlement === "locked"
  const KindIcon =
    material.kind === "recording"
      ? VideoIcon
      : material.kind === "file"
        ? FileTextIcon
        : BookOpenIcon
  const priceLabel =
    storeEnabled && material.accessType === "paid" && material.price !== null
      ? formatLkr(material.price)
      : null
  const storeUnavailable =
    material.accessType === "paid" && !storeEnabled
      ? "Content store unavailable"
      : null

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        locked && "border-dashed bg-muted/20"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            materialKindTones[material.kind]
          )}
        >
          <KindIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <MaterialKindBadge kind={material.kind} />
            <MaterialAccessBadge accessType={material.accessType} />
            {material.entitlement !== "available" ? (
              <MaterialEntitlementBadge entitlement={material.entitlement} />
            ) : null}
          </div>
          <p
            className={cn(
              "text-sm leading-snug font-medium",
              locked && "text-muted-foreground"
            )}
          >
            {material.title}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {material.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRoundIcon className="size-3" aria-hidden="true" />
          {material.lecturer}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDaysIcon className="size-3" aria-hidden="true" />
          {formatDisplayDate(material.publishedOn)}
        </span>
        {material.duration ? <span>{material.duration}</span> : null}
        {material.fileType ? <span>{material.fileType}</span> : null}
        {material.pages ? <span>{material.pages} pages</span> : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        {priceLabel ? (
          <span className="text-sm font-medium tabular-nums">
            {priceLabel}
            {material.entitlement === "purchased" ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                paid
              </span>
            ) : null}
          </span>
        ) : storeUnavailable ? (
          <span className="text-xs text-muted-foreground">
            {storeUnavailable}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No charge</span>
        )}
        {locked ? (
          storeEnabled ? (
            <Button variant="outline" size="xs" onClick={onPurchase}>
              <LockKeyholeIcon data-icon="inline-start" aria-hidden="true" />
              Preview purchase
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
              Paid content unavailable
            </span>
          )
        ) : (
          <Button variant="outline" size="xs" onClick={onPreview}>
            {material.kind === "recording" ? (
              <PlayIcon data-icon="inline-start" aria-hidden="true" />
            ) : material.kind === "book" ? (
              <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
            ) : (
              <FileTextIcon data-icon="inline-start" aria-hidden="true" />
            )}
            {material.kind === "recording"
              ? "Preview recording"
              : material.kind === "book"
                ? "View book details"
                : "Open preview"}
          </Button>
        )}
      </div>
    </div>
  )
}

function MaterialPreviewDialog({
  material,
  onOpenChange,
}: {
  material: LearningMaterial | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={material !== null} onOpenChange={onOpenChange}>
      {material ? (
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <MaterialKindBadge kind={material.kind} />
              <MaterialAccessBadge accessType={material.accessType} />
              {material.entitlement !== "available" ? (
                <MaterialEntitlementBadge entitlement={material.entitlement} />
              ) : null}
            </div>
            <DialogTitle className="text-lg">{material.title}</DialogTitle>
            <DialogDescription>
              {material.courseName} · {material.section}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {material.description}
          </p>

          <div className="grid gap-3 text-sm">
            <DetailRow
              icon={UserRoundIcon}
              label="Lecturer"
              value={material.lecturer}
            />
            <DetailRow
              icon={CalendarDaysIcon}
              label="Published"
              value={formatDisplayDate(material.publishedOn)}
            />
            {material.duration ? (
              <DetailRow
                icon={VideoIcon}
                label="Duration"
                value={material.duration}
              />
            ) : null}
            {material.fileType ? (
              <DetailRow
                icon={FileTextIcon}
                label="File type"
                value={material.fileType}
              />
            ) : null}
            {material.pages ? (
              <DetailRow
                icon={BookOpenIcon}
                label="Length"
                value={`${material.pages} pages`}
              />
            ) : null}
          </div>

          <Separator />

          <MaterialPreviewPanel material={material} />

          <DialogFooter showCloseButton />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function MaterialPreviewPanel({ material }: { material: LearningMaterial }) {
  const isRecording = material.kind === "recording"
  const isBook = material.kind === "book"
  const Icon = isRecording ? PlayIcon : isBook ? BookOpenIcon : FileTextIcon

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md px-4 py-8 text-center",
          isRecording
            ? "bg-slate-950 text-slate-100"
            : "border bg-background/60"
        )}
      >
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full",
            isRecording
              ? "bg-white/10 text-white"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">
          {isRecording
            ? "Recording preview placeholder"
            : isBook
              ? `Physical book · ${student.branch} library desk`
              : "File preview placeholder"}
        </p>
        <p
          className={cn(
            "max-w-xs text-xs leading-relaxed",
            isRecording ? "text-slate-300" : "text-muted-foreground"
          )}
        >
          {isRecording
            ? "Playback is not connected in this demo. No recording is streamed."
            : isBook
              ? "Collect from the library desk during office hours. No reservation is made in this demo."
              : "No file is downloaded or opened in this demo."}
        </p>
      </div>
      <Button variant="outline" size="sm" disabled>
        {isRecording ? (
          <PlayIcon data-icon="inline-start" aria-hidden="true" />
        ) : isBook ? (
          <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <DownloadIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {isRecording
          ? "Play recording"
          : isBook
            ? "Reserve book"
            : "Download file"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Local preview only. No download, playback or reservation is connected.
      </p>
    </div>
  )
}

function MaterialPurchaseDialog({
  material,
  step,
  storeEnabled,
  onStepChange,
  onOpenChange,
}: {
  material: LearningMaterial | null
  step: PurchaseStep
  storeEnabled: boolean
  onStepChange: (step: PurchaseStep) => void
  onOpenChange: (open: boolean) => void
}) {
  const price = material?.price ?? 0

  return (
    <Dialog open={material !== null} onOpenChange={onOpenChange}>
      {material && storeEnabled ? (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <MaterialKindBadge kind={material.kind} />
              <MaterialAccessBadge accessType={material.accessType} />
              <MaterialEntitlementBadge entitlement="locked" />
            </div>
            <DialogTitle className="text-lg">
              {step === "done" ? "Purchase preview complete" : material.title}
            </DialogTitle>
            <DialogDescription>
              {material.courseName} · {material.section}
            </DialogDescription>
          </DialogHeader>

          {step === "details" ? (
            <>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Price</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {formatLkr(price)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  One-time local demo price for this material.
                </p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This is a local purchase preview. No payment will be taken, no
                card details are requested, and the item remains locked.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={() => onStepChange("review")}>
                  <ShoppingBagIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : step === "review" ? (
            <>
              <div className="grid gap-2 rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Item</span>
                  <span className="text-right font-medium">
                    {material.title}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium tabular-nums">
                    {formatLkr(price)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="text-right">Not collected in demo</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                In a live system, access would unlock after payment
                verification. This preview does not process a payment or unlock
                the item.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => onStepChange("details")}
                >
                  Back
                </Button>
                <Button onClick={() => onStepChange("done")}>
                  Preview request
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/5 p-3 text-sm">
                <CheckCircle2Icon
                  className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium">Demo request previewed</p>
                  <p className="text-muted-foreground">
                    No payment was taken. The item remains locked in this demo
                    until a real payment is verified.
                  </p>
                </div>
              </div>
              <DialogFooter showCloseButton />
            </>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span>{value}</span>
      </div>
    </div>
  )
}
