"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { LanguagesIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import LanguageDropdown from "@/components/blocks/dropdown-language"
import ProfileDropdown from "@/components/blocks/dropdown-profile"
import { sidebarNav } from "@/lib/navigation"

export function AppHeader() {
  const pathname = usePathname()
  const currentPage = sidebarNav
    .flatMap((group) => group.items)
    .find((item) => item.url === pathname)
  const currentTitle =
    pathname === "/"
      ? "Dashboard"
      : (currentPage?.title ??
        pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ??
        "Dashboard")

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="[&_svg]:size-5!" />
          <Separator
            orientation="vertical"
            className="hidden h-4! sm:block data-vertical:self-center"
          />
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="capitalize">
                  {currentTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center gap-1.5">
          <LanguageDropdown
            trigger={
              <Button variant="ghost" size="icon-lg">
                <LanguagesIcon />
              </Button>
            }
          />
          <ProfileDropdown
            trigger={
              <Button variant="ghost" size="icon-lg">
                <Avatar className="size-[inherit] rounded-[inherit] after:rounded-[inherit]">
                  <AvatarImage
                    src="https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png"
                    className="rounded-[inherit]"
                  />
                  <AvatarFallback className="rounded-[inherit]">
                    JD
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
          />
        </div>
      </div>
    </header>
  )
}
