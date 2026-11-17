"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"

import { Badge } from "@workspace/ui/components/badge"
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
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { InfoIcon, RotateCcwIcon, SaveIcon } from "lucide-react"

import {
  MOCK_NOW,
  getTemplatePlaceholders,
  notificationChannelLabels,
  notificationEventDescriptions,
  notificationEventLabels,
  renderTemplatePreview,
  type NotificationTemplateRecord,
} from "@/lib/notifications-data"

type TemplateEditDialogProps = {
  template: NotificationTemplateRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (template: NotificationTemplateRecord) => void
}

export function TemplateEditDialog({
  template,
  open,
  onOpenChange,
  onSave,
}: TemplateEditDialogProps) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !template) return

    setSubject(template.subject ?? "")
    setBody(template.body)
    setError(null)
  }, [open, template])

  if (!template) return null

  const activeTemplate = template
  const placeholders = getTemplatePlaceholders(activeTemplate.event)
  const previewSubject = renderTemplatePreview(
    subject,
    activeTemplate.event
  )
  const previewBody = renderTemplatePreview(body, activeTemplate.event)
  const isDirty =
    subject !== (activeTemplate.subject ?? "") ||
    body !== activeTemplate.body

  function insertPlaceholder(placeholder: string) {
    const token = `{{${placeholder}}}`
    setBody((previous) => {
      if (!previous) return token
      if (previous.endsWith(" ") || previous.endsWith("\n")) {
        return `${previous}${token}`
      }

      return `${previous} ${token}`
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!body.trim()) {
      setError("The body is required.")
      return
    }

    setError(null)
    onSave({
      ...activeTemplate,
      subject: subject.trim() ? subject.trim() : null,
      body,
      updatedAt: MOCK_NOW,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Edit template
            <Badge
              variant="outline"
              className="rounded-full text-muted-foreground"
            >
              {notificationChannelLabels[template.channel]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {notificationEventLabels[template.event]} ·{" "}
            {notificationEventDescriptions[template.event]} Editing a template
            updates this browser session only — no message is queued or sent.
          </DialogDescription>
        </DialogHeader>

        <form
          id="template-edit-form"
          className="flex flex-col gap-5"
          onSubmit={handleSubmit}
          noValidate
        >
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-subject">Subject</Label>
            <Input
              id="template-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Email and in-app subject"
            />
            <p className="text-xs text-muted-foreground">
              Used by email and in-app notifications. SMS and push use the body
              only.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="template-body">
                Body
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <span className="text-xs text-muted-foreground">
                {placeholders.length} supported{" "}
                {placeholders.length === 1 ? "placeholder" : "placeholders"}
              </span>
            </div>
            <Textarea
              id="template-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              placeholder="Write the message body using {{placeholders}}."
              className="min-h-[10rem]"
            />
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((placeholder) => (
                <Button
                  key={placeholder}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 rounded-full px-2 font-mono text-[11px]"
                  onClick={() => insertPlaceholder(placeholder)}
                >
                  {`{{${placeholder}}}`}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click a placeholder to append it to the body. Unknown placeholders
              are left unchanged in the preview.
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Preview</span>
              <Badge
                variant="outline"
                className="rounded-full text-muted-foreground"
              >
                Sample data
              </Badge>
            </div>
            <div className="rounded-lg border bg-muted/20 px-4 py-3">
              {previewSubject ? (
                <p className="text-sm font-medium">{previewSubject}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No subject — this channel sends the body only.
                </p>
              )}
              <p className="mt-1.5 text-sm whitespace-pre-line text-muted-foreground">
                {previewBody || "The body is empty."}
              </p>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Preview values are fixed examples for this event. Real values come
              from each notification&apos;s payload.
            </p>
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSubject(template.subject ?? "")
              setBody(template.body)
              setError(null)
            }}
            disabled={!isDirty}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Reset
          </Button>
          <Button type="submit" form="template-edit-form" disabled={!isDirty}>
            <SaveIcon data-icon="inline-start" />
            Save (demo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
