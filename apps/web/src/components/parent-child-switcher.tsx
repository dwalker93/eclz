"use client"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronsUpDownIcon, UsersRoundIcon } from "lucide-react"

import { useParentChild } from "@/components/parent-child-context"

/**
 * Compact parent child switcher. Rendered in the shared portal header on
 * wider screens and as a header row on small screens. It only offers children
 * linked to the signed-in guardian.
 */
export function ParentChildSwitcher({
  variant = "header",
}: {
  variant?: "header" | "bar"
}) {
  const { children, selectedChild, selectedChildId, selectChild } =
    useParentChild()

  if (!selectedChild) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          variant === "bar"
            ? "w-full rounded-lg border border-dashed px-3 py-2"
            : "rounded-full border border-dashed px-3 py-2"
        )}
      >
        <UsersRoundIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>No linked children</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Viewing ${selectedChild.fullName}. Change linked child.`}
            className={cn(
              "flex min-w-0 items-center gap-2 border text-left transition-colors outline-none hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              variant === "bar"
                ? "w-full rounded-lg bg-muted/20 py-1.5 pr-2.5 pl-1.5"
                : "max-w-56 rounded-full bg-muted/30 py-1 pr-2 pl-1"
            )}
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-[11px]">
                {selectedChild.initials}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="flex min-w-0 items-baseline gap-1">
                <span className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Viewing
                </span>
                <span className="truncate text-sm font-semibold">
                  {selectedChild.fullName}
                </span>
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {selectedChild.grade} · {selectedChild.branch} branch
              </span>
            </span>
            <ChevronsUpDownIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Linked children</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={selectedChildId}
            onValueChange={(value) => selectChild(String(value))}
          >
            {children.map((child) => (
              <DropdownMenuRadioItem
                key={child.id}
                value={child.id}
                className="gap-2.5 py-2"
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="text-[11px]">
                    {child.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-medium">
                    {child.fullName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {child.grade} · {child.branch} · {child.studentNo}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <p className="px-2 py-1 text-xs leading-relaxed text-muted-foreground">
            Only children linked to your guardian record are shown. Selecting a
            child updates every parent page.
          </p>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
