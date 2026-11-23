"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Separator } from "@workspace/ui/components/separator"
import {
  BellIcon,
  GraduationCapIcon,
  MoonIcon,
  PresentationIcon,
  SparklesIcon,
  SunIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { lecturer } from "@/lib/lecturer-portal-data"
import { lecturerNav } from "@/lib/lecturer-navigation"
import { parent, parentChildren } from "@/lib/parent-portal-data"
import { parentNav } from "@/lib/parent-navigation"
import { student } from "@/lib/student-portal-data"
import { studentNav, type PortalNavGroup } from "@/lib/student-navigation"

export type PortalRole = "student" | "lecturer" | "parent"

type PortalShellConfig = {
  roleLabel: string
  homeHref: string
  nav: PortalNavGroup[]
  brandIcon: LucideIcon
  identity: {
    fullName: string
    initials: string
    /** Secondary line shown under the name, e.g. "STU-2024-0114 · Grade 8". */
    meta: string
  }
  notificationsHref: string
  notificationsLabel: string
  footerCopy: string
}

const portalShellConfigs: Record<PortalRole, PortalShellConfig> = {
  student: {
    roleLabel: "Student portal",
    homeHref: "/portal/student",
    nav: studentNav,
    brandIcon: GraduationCapIcon,
    identity: {
      fullName: student.fullName,
      initials: student.initials,
      meta: `${student.studentNo} · ${student.grade}`,
    },
    notificationsHref: "/portal/student#recent-notifications",
    notificationsLabel: "Go to recent notifications",
    footerCopy:
      "Dashboard, My Courses, Timetable, Attendance, Learning Materials, Exams & Results, Invoices & Payments, Notices, Messages and My Profile are available. Other portal pages are planned for later steps.",
  },
  lecturer: {
    roleLabel: "Lecturer portal",
    homeHref: "/portal/lecturer",
    nav: lecturerNav,
    brandIcon: PresentationIcon,
    identity: {
      fullName: lecturer.fullName,
      initials: lecturer.initials,
      meta: `${lecturer.lecturerNo} · ${lecturer.designation}`,
    },
    notificationsHref: "/portal/lecturer#recent-notices",
    notificationsLabel: "Go to recent notices",
    footerCopy:
      "Dashboard, My Courses, Timetable & Sessions, Attendance, Learning Materials, Exams, Question Bank, Results, Notices, Messages, My Earnings and My Profile are available. Other lecturer pages are planned for later steps.",
  },
  parent: {
    roleLabel: "Parent portal",
    homeHref: "/portal/parent",
    nav: parentNav,
    brandIcon: UsersRoundIcon,
    identity: {
      fullName: parent.fullName,
      initials: parent.initials,
      meta: `Guardian · ${parentChildren.length} linked children`,
    },
    notificationsHref: "/portal/parent#latest-notice",
    notificationsLabel: "Go to the latest notice",
    footerCopy:
      "Dashboard and My Children are available. Other parent pages are planned for later steps.",
  },
}

function PortalSidebar({ config }: { config: PortalShellConfig }) {
  const pathname = usePathname()
  const BrandIcon = config.brandIcon

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <Link
          href={config.homeHref}
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BrandIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-heading text-sm font-semibold">ECLZ</span>
            <span className="truncate text-xs text-muted-foreground">
              {config.roleLabel}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label={config.roleLabel}>
          {config.nav.map((group) => (
            <SidebarGroup key={group.label ?? "home"}>
              {group.label ? (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = item.url === pathname
                    const content = (
                      <>
                        <Icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </>
                    )

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          render={
                            item.url ? <Link href={item.url} /> : undefined
                          }
                          isActive={isActive}
                          disabled={item.disabled}
                          aria-current={isActive ? "page" : undefined}
                          title={
                            item.disabled
                              ? `${item.title} (planned)`
                              : item.title
                          }
                        >
                          {content}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <SparklesIcon className="size-3.5" aria-hidden="true" />
            Demo preview
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {config.footerCopy}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

function PortalHeader({ config }: { config: PortalShellConfig }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"
  const currentTitle =
    config.nav
      .flatMap((group) => group.items)
      .find((item) => item.url === pathname)?.title ?? config.roleLabel

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <SidebarTrigger className="[&_svg]:size-5!" />
          <Separator
            orientation="vertical"
            className="hidden h-4! sm:block data-vertical:self-center"
          />
          <Breadcrumb className="hidden min-w-0 sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={config.homeHref} />}>
                  {config.roleLabel}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{currentTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Badge
            variant="outline"
            className="hidden rounded-full md:inline-flex"
          >
            Demo preview
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <a
            href={config.notificationsHref}
            aria-label={config.notificationsLabel}
            className="relative inline-flex size-10 items-center justify-center rounded-md text-sm font-medium transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <BellIcon className="size-5" aria-hidden="true" />
            <span className="absolute top-2 right-2.5 size-2 rounded-full bg-primary ring-2 ring-card" />
          </a>

          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={
              mounted
                ? `Switch to ${isDark ? "light" : "dark"} theme`
                : "Toggle theme"
            }
          >
            {isDark ? (
              <SunIcon aria-hidden="true" />
            ) : (
              <MoonIcon aria-hidden="true" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={`Account menu for ${config.identity.fullName}`}
                >
                  <Avatar className="size-[inherit] rounded-[inherit] after:rounded-[inherit]">
                    <AvatarFallback className="rounded-[inherit] text-xs">
                      {config.identity.initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
                <Avatar size="lg">
                  <AvatarFallback>{config.identity.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {config.identity.fullName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {config.identity.meta}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                My profile
                <DropdownMenuShortcut>Soon</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Account settings
                <DropdownMenuShortcut>Soon</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <p className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                Local demo session. No sign-in or account access is connected.
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export function PortalShell({
  role = "student",
  children,
}: {
  role?: PortalRole
  children: React.ReactNode
}) {
  const config = portalShellConfigs[role]

  return (
    <div className="flex min-h-dvh w-full">
      <SidebarProvider className="min-w-0">
        <PortalSidebar config={config} />
        <div className="flex min-w-0 flex-1 flex-col">
          <PortalHeader config={config} />
          {children}
        </div>
      </SidebarProvider>
    </div>
  )
}
