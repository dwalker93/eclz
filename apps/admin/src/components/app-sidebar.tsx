"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { usePathname } from "next/navigation"

import { sidebarNav } from "@/lib/navigation"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarContent>
        {sidebarNav.map((group) => (
          <SidebarGroup key={group.label ?? "overview"}>
            {group.label ? (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ title, url, icon: Icon, badge }) => (
                  <SidebarMenuItem key={title}>
                    <SidebarMenuButton
                      render={<a href={url} />}
                      isActive={url !== "#" && pathname === url}
                    >
                      <Icon />
                      <span>{title}</span>
                    </SidebarMenuButton>
                    {badge !== undefined ? (
                      <SidebarMenuBadge className="top-1/2! right-2 -translate-y-1/2! rounded-full bg-primary/10">
                        {badge}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
