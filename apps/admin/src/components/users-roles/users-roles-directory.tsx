"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@workspace/ui/components/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  BadgeCheckIcon,
  Building2Icon,
  CircleAlertIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  InfoIcon,
  KeyRoundIcon,
  Link2Icon,
  LockIcon,
  MailIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"

import {
  AssignmentDialog,
  type AssignmentDraft,
} from "@/components/users-roles/assignment-dialog"
import {
  RoleEditorDialog,
  type RoleDraft,
} from "@/components/users-roles/role-editor-dialog"
import {
  BranchBadge,
  ProfileKindBadge,
  UserDetailSheet,
  UserStatusBadge,
} from "@/components/users-roles/user-detail-sheet"
import {
  UserFormDialog,
  type UserDraft,
} from "@/components/users-roles/user-form-dialog"
import { usePagination } from "@/hooks/use-pagination"
import {
  MULTI_PROFILE_NOTE,
  PERMISSION_GROUPS,
  ROOT_ADMIN_ROLE_ID,
  SYSTEM_ROLE_NOTE,
  assignmentBranchFilterOptions,
  getBranchName,
  getRoleById,
  getRolesSummary,
  getRolesWithPermission,
  getUsersSummary,
  isLastRootAdmin,
  isRootAdmin,
  roleFilterOptions,
  roles as roleSeeds,
  staffRoleAssignments as assignmentSeeds,
  userKindFilterOptions,
  userStatusFilterOptions,
  users as userSeeds,
  type RoleRecord,
  type StaffRoleAssignment,
  type UserRecord,
  type UserStatus,
} from "@/lib/users-roles-data"
import { MOCK_TODAY, formatDateTime, getInitials } from "@/lib/students-data"

type UsersRolesTab = "users" | "roles" | "assignments" | "permissions"

const PAGE_SIZE = 8

const tabOrder: UsersRolesTab[] = [
  "users",
  "roles",
  "assignments",
  "permissions",
]

const tabLabels: Record<UsersRolesTab, string> = {
  users: "Users",
  roles: "Roles",
  assignments: "Assignments",
  permissions: "Permissions",
}

const tabIcons: Record<UsersRolesTab, ReactNode> = {
  users: <UsersIcon aria-hidden="true" />,
  roles: <ShieldCheckIcon aria-hidden="true" />,
  assignments: <UserPlusIcon aria-hidden="true" />,
  permissions: <KeyRoundIcon aria-hidden="true" />,
}

export function UsersRolesDirectory() {
  const [activeTab, setActiveTab] = useState<UsersRolesTab>("users")
  const [users, setUsers] = useState<UserRecord[]>(() =>
    userSeeds.map((user) => ({ ...user, profiles: [...user.profiles] }))
  )
  const [roles, setRoles] = useState<RoleRecord[]>(() =>
    roleSeeds.map((role) => ({
      ...role,
      permissionCodes: [...role.permissionCodes],
    }))
  )
  const [assignments, setAssignments] = useState<StaffRoleAssignment[]>(() =>
    assignmentSeeds.map((assignment) => ({ ...assignment }))
  )

  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [kindFilter, setKindFilter] = useState("all")
  const [page, setPage] = useState(1)

  const [roleScopeFilter, setRoleScopeFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")

  const [permissionSearch, setPermissionSearch] = useState("")

  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const userCreateCountRef = useRef(0)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailUserId, setDetailUserId] = useState<string | null>(null)

  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const roleCreateCountRef = useRef(0)

  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false)
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(
    null
  )
  const assignmentCreateCountRef = useRef(0)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Users, roles and assignments refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const query = search.trim().toLowerCase()

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (statusFilter !== "all" && user.status !== statusFilter) return false
      if (kindFilter === "staff" && !user.isStaff) return false
      if (kindFilter === "portal" && user.isStaff) return false
      if (kindFilter === "linked" && user.profiles.length === 0) return false
      if (query.length === 0) return true

      return [user.fullName, user.email, user.username, user.phone ?? ""].some(
        (value) => value.toLowerCase().includes(query)
      )
    })
  }, [users, query, statusFilter, kindFilter])

  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / PAGE_SIZE)
  )
  const currentPage = Math.min(page, totalUserPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const pagedUsers = filteredUsers.slice(startIndex, startIndex + PAGE_SIZE)
  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages: totalUserPages,
    paginationItemsToDisplay: 5,
  })

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      if (roleScopeFilter !== "all" && assignment.roleId !== roleScopeFilter) {
        return false
      }
      if (branchFilter === "all-branches") return assignment.branchId === null
      if (branchFilter !== "all" && assignment.branchId !== branchFilter) {
        return false
      }
      return true
    })
  }, [assignments, roleScopeFilter, branchFilter])

  const permissionQuery = permissionSearch.trim().toLowerCase()
  const permissionGroupsFiltered = useMemo(() => {
    if (permissionQuery.length === 0) return PERMISSION_GROUPS

    return PERMISSION_GROUPS.map((group) => ({
      ...group,
      permissions: group.permissions.filter(
        (permission) =>
          permission.code.toLowerCase().includes(permissionQuery) ||
          permission.description.toLowerCase().includes(permissionQuery)
      ),
    })).filter((group) => group.permissions.length > 0)
  }, [permissionQuery])

  const usersSummary = getUsersSummary(users)
  const rolesSummary = getRolesSummary(roles, assignments)

  const editingUser =
    !isCreatingUser && editingUserId
      ? (users.find((user) => user.id === editingUserId) ?? null)
      : null
  const editingRole =
    !isCreatingRole && editingRoleId
      ? (roles.find((role) => role.id === editingRoleId) ?? null)
      : null
  const editingAssignment =
    !isCreatingAssignment && editingAssignmentId
      ? (assignments.find((item) => item.id === editingAssignmentId) ?? null)
      : null
  const detailUser = detailUserId
    ? (users.find((user) => user.id === detailUserId) ?? null)
    : null

  const countFor = (tab: UsersRolesTab) => {
    if (tab === "users") return usersSummary.total
    if (tab === "roles") return rolesSummary.total
    if (tab === "assignments") return assignments.length
    return PERMISSION_GROUPS.reduce(
      (total, group) => total + group.permissions.length,
      0
    )
  }

  function openCreateUser() {
    setEditingUserId(null)
    setIsCreatingUser(true)
    setUserDialogOpen(true)
  }

  function openEditUser(user: UserRecord) {
    setEditingUserId(user.id)
    setIsCreatingUser(false)
    setDetailOpen(false)
    setUserDialogOpen(true)
  }

  function openDetail(user: UserRecord) {
    setDetailUserId(user.id)
    setDetailOpen(true)
  }

  function handleSaveUser(draft: UserDraft, userId: string | null) {
    if (userId) {
      setUsers((previous) =>
        previous.map((user) =>
          user.id === userId ? { ...user, ...draft } : user
        )
      )
      setNotice(
        `“${draft.fullName}” updated in this session. Local demo only — nothing was saved.`
      )
    } else {
      userCreateCountRef.current += 1
      const newUser: UserRecord = {
        id: `usr-new-${userCreateCountRef.current}`,
        ...draft,
        lastLoginAt: null,
        createdAt: MOCK_TODAY,
        isStaff: true,
        mfaEnabled: false,
        passwordChangedAt: null,
        profiles: [],
      }
      setUsers((previous) => [newUser, ...previous])
      setNotice(
        `“${draft.fullName}” added in this session. Local demo only — nothing was saved.`
      )
    }
    setUserDialogOpen(false)
  }

  function toggleUserStatus(user: UserRecord) {
    if (user.status === "active" && isLastRootAdmin(user.id, assignments)) {
      setNotice(
        `Blocked: ${user.fullName} is the only root admin. Give another user the root admin role before disabling this account.`
      )
      return
    }

    const nextStatus: UserStatus =
      user.status === "active" ? "disabled" : "active"
    setUsers((previous) =>
      previous.map((item) =>
        item.id === user.id ? { ...item, status: nextStatus } : item
      )
    )
    setNotice(
      `“${user.fullName}” ${nextStatus === "active" ? "enabled" : "disabled"} in this session. Roles and profile links were kept. Nothing was saved.`
    )
  }

  function openCreateRole() {
    setEditingRoleId(null)
    setIsCreatingRole(true)
    setRoleDialogOpen(true)
  }

  function openEditRole(role: RoleRecord) {
    setEditingRoleId(role.id)
    setIsCreatingRole(false)
    setRoleDialogOpen(true)
  }

  function handleSaveRole(draft: RoleDraft, roleId: string | null) {
    if (roleId) {
      setRoles((previous) =>
        previous.map((role) =>
          role.id === roleId
            ? {
                ...role,
                name: draft.name,
                description: draft.description,
                permissionCodes: draft.permissionCodes,
              }
            : role
        )
      )
      setNotice(
        `Role “${draft.name}” updated in this session. Local demo only — nothing was saved.`
      )
    } else {
      roleCreateCountRef.current += 1
      setRoles((previous) => [
        ...previous,
        {
          id: `role-new-${roleCreateCountRef.current}`,
          name: draft.name,
          description: draft.description,
          isSystem: draft.isSystem,
          permissionCodes: draft.permissionCodes,
        },
      ])
      setNotice(
        `Role “${draft.name}” created in this session. Local demo only — nothing was saved.`
      )
    }
    setRoleDialogOpen(false)
  }

  function deleteRole(role: RoleRecord) {
    if (role.isSystem) {
      setNotice(`“${role.name}” is a built-in role and cannot be deleted.`)
      return
    }

    const assignedCount = assignments.filter(
      (assignment) => assignment.roleId === role.id
    ).length

    if (assignedCount > 0) {
      setNotice(
        `“${role.name}” still has ${assignedCount} assignment${assignedCount === 1 ? "" : "s"}. Remove them from the Assignments tab first.`
      )
      return
    }

    setRoles((previous) => previous.filter((item) => item.id !== role.id))
    setNotice(
      `Role “${role.name}” removed in this session. Local demo only — nothing was saved.`
    )
  }

  function openCreateAssignment() {
    setEditingAssignmentId(null)
    setIsCreatingAssignment(true)
    setAssignmentDialogOpen(true)
  }

  function openEditAssignment(assignment: StaffRoleAssignment) {
    setEditingAssignmentId(assignment.id)
    setIsCreatingAssignment(false)
    setAssignmentDialogOpen(true)
  }

  function handleSaveAssignment(draft: AssignmentDraft, id: string | null) {
    const user = users.find((item) => item.id === draft.userId)
    const role = roles.find((item) => item.id === draft.roleId)

    if (id) {
      setAssignments((previous) =>
        previous.map((assignment) =>
          assignment.id === id
            ? { ...assignment, branchId: draft.branchId }
            : assignment
        )
      )
      setNotice(
        `Assignments for “${user?.fullName ?? "user"}” updated in this session. Local demo only — nothing was saved.`
      )
    } else {
      assignmentCreateCountRef.current += 1
      setAssignments((previous) => [
        ...previous,
        { id: `sra-new-${assignmentCreateCountRef.current}`, ...draft },
      ])
      setNotice(
        `“${role?.name ?? "Role"}” assigned to ${user?.fullName ?? "user"} for ${getBranchName(draft.branchId)}. Local demo only — nothing was saved.`
      )
    }
    setAssignmentDialogOpen(false)
  }

  function removeAssignment(assignment: StaffRoleAssignment) {
    const user = users.find((item) => item.id === assignment.userId)

    if (
      assignment.roleId === ROOT_ADMIN_ROLE_ID &&
      assignment.branchId === null &&
      isLastRootAdmin(assignment.userId, assignments)
    ) {
      setNotice(
        `Blocked: ${user?.fullName ?? "this user"} is the only root admin. Assign the root admin role to another user before removing this one.`
      )
      return
    }

    setAssignments((previous) =>
      previous.filter((item) => item.id !== assignment.id)
    )
    setNotice(
      `Assignment removed for ${user?.fullName ?? "user"} in this session. Nothing was saved.`
    )
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return
    }

    event.preventDefault()

    if (event.key === "Home") {
      setActiveTab(tabOrder[0] ?? "users")
      document.getElementById("ur-tab-users")?.focus()
      return
    }

    if (event.key === "End") {
      const last = tabOrder[tabOrder.length - 1] ?? "users"
      setActiveTab(last)
      document.getElementById(`ur-tab-${last}`)?.focus()
      return
    }

    const currentIndex = tabOrder.indexOf(activeTab)
    const direction = event.key === "ArrowRight" ? 1 : -1
    const nextIndex =
      (currentIndex + direction + tabOrder.length) % tabOrder.length
    const nextTab = tabOrder[nextIndex] ?? activeTab
    setActiveTab(nextTab)
    document.getElementById(`ur-tab-${nextTab}`)?.focus()
  }

  function clearUserFilters() {
    setSearch("")
    setStatusFilter("all")
    setKindFilter("all")
    setPage(1)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Users &amp; Roles
              <Badge variant="outline" className="rounded-full">
                <ShieldCheckIcon aria-hidden="true" />
                Access control
              </Badge>
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Logins, roles, permissions and staff assignments built from{" "}
              <code>user</code>, <code>role</code>, <code>permission</code>,{" "}
              <code>role_permission</code> and{" "}
              <code>staff_role_assignment</code>. This is a UI preview — nothing
              on this page is saved and no real authorization is enforced.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsRefreshing(true)}
              disabled={isRefreshing}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                className={isRefreshing ? "animate-spin" : undefined}
              />
              {isRefreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{notice}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
            >
              <XIcon />
            </Button>
          </div>
        ) : null}

        <div
          role="tablist"
          aria-label="Users and roles sections"
          onKeyDown={handleTabKeyDown}
          className="inline-flex w-fit flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1"
        >
          {tabOrder.map((tab) => (
            <TabButton
              key={tab}
              id={`ur-tab-${tab}`}
              controls="ur-panel"
              isActive={activeTab === tab}
              icon={tabIcons[tab]}
              label={tabLabels[tab]}
              count={countFor(tab)}
              onClick={() => setActiveTab(tab)}
            />
          ))}
        </div>

        <div
          id="ur-panel"
          role="tabpanel"
          aria-labelledby={`ur-tab-${activeTab}`}
          tabIndex={0}
          className="flex flex-col gap-4 focus-visible:outline-none"
        >
          {isRefreshing ? (
            <UsersRolesSkeleton />
          ) : activeTab === "users" ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard
                  icon={<UsersIcon aria-hidden="true" />}
                  value={usersSummary.total}
                  label="Logins"
                  hint={`${usersSummary.staff} staff · ${usersSummary.total - usersSummary.staff} portal`}
                />
                <SummaryCard
                  icon={<BadgeCheckIcon aria-hidden="true" />}
                  value={usersSummary.active}
                  label="Active"
                  hint="Can sign in"
                />
                <SummaryCard
                  icon={<CircleAlertIcon aria-hidden="true" />}
                  value={usersSummary.disabled}
                  label="Disabled"
                  hint="Kept, but cannot sign in"
                />
                <SummaryCard
                  icon={<Link2Icon aria-hidden="true" />}
                  value={usersSummary.withPortalProfiles}
                  label="With profiles"
                  hint="Lecturer, student or guardian"
                />
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
                <Link2Icon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{MULTI_PROFILE_NOTE}</span>
              </div>

              <Card className="gap-0 py-0">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-0.5">
                    <CardTitle className="flex items-center gap-2">
                      <UsersIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Users
                    </CardTitle>
                    <CardDescription>
                      {filteredUsers.length} of {users.length}{" "}
                      {users.length === 1 ? "login" : "logins"}
                    </CardDescription>
                  </div>
                  <Button onClick={openCreateUser}>
                    <PlusIcon data-icon="inline-start" />
                    Add user
                  </Button>
                </CardHeader>

                <div className="border-b px-4 py-3 sm:px-6">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="relative lg:col-span-2">
                      <SearchIcon
                        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        type="search"
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value)
                          setPage(1)
                        }}
                        placeholder="Search by name, email, username or phone"
                        aria-label="Search users"
                        className="pl-8"
                      />
                    </div>

                    <Select
                      items={userStatusFilterOptions}
                      value={statusFilter}
                      onValueChange={(value) => {
                        setStatusFilter(value ?? "all")
                        setPage(1)
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label="Filter by status"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {userStatusFilterOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      items={userKindFilterOptions}
                      value={kindFilter}
                      onValueChange={(value) => {
                        setKindFilter(value ?? "all")
                        setPage(1)
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label="Filter by login kind"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {userKindFilterOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredUsers.length === 0 ? (
                  <EmptyState
                    icon={<UsersIcon aria-hidden="true" />}
                    title="No users match"
                    description="Try a different search term, status or login kind."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearUserFilters}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                            User
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Phone
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Status
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Last login
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Roles &amp; branches
                          </TableHead>
                          <TableHead className="w-12 pr-4 text-right sm:pr-6">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedUsers.map((user) => {
                          const userAssignments = assignments.filter(
                            (assignment) => assignment.userId === user.id
                          )
                          const rootAdmin = isRootAdmin(user.id, assignments)

                          return (
                            <TableRow
                              key={user.id}
                              className={
                                user.status === "active"
                                  ? undefined
                                  : "opacity-70"
                              }
                            >
                              <TableCell className="py-3 pl-4 sm:pl-6">
                                <div className="flex items-start gap-3">
                                  <Avatar size="sm" className="mt-0.5">
                                    <AvatarFallback>
                                      {getInitials(user.fullName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex min-w-0 flex-col gap-1">
                                    <span className="flex flex-wrap items-center gap-1.5 font-medium">
                                      {user.fullName}
                                      {rootAdmin ? (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full border-primary/20 bg-primary/10 text-primary"
                                        >
                                          <ShieldCheckIcon aria-hidden="true" />
                                          Root
                                        </Badge>
                                      ) : null}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {user.email} · @{user.username}
                                    </span>
                                    {user.profiles.length > 0 ? (
                                      <span className="flex flex-wrap items-center gap-1.5">
                                        {user.profiles.map((profile) => (
                                          <ProfileKindBadge
                                            key={`${profile.kind}-${profile.id}`}
                                            kind={profile.kind}
                                          />
                                        ))}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {user.phone ?? "—"}
                              </TableCell>
                              <TableCell>
                                <UserStatusBadge status={user.status} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {user.lastLoginAt
                                  ? formatDateTime(user.lastLoginAt)
                                  : "No login recorded"}
                              </TableCell>
                              <TableCell>
                                {userAssignments.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {userAssignments
                                      .slice(0, 2)
                                      .map((assignment) => {
                                        const role = getRoleById(
                                          assignment.roleId,
                                          roles
                                        )
                                        return (
                                          <span
                                            key={assignment.id}
                                            className="flex flex-wrap items-center gap-1 text-xs"
                                          >
                                            <Badge
                                              variant="secondary"
                                              className="rounded-full"
                                            >
                                              {role?.name ?? "Unknown role"}
                                            </Badge>
                                            <span className="text-muted-foreground">
                                              {getBranchName(
                                                assignment.branchId
                                              )}
                                            </span>
                                          </span>
                                        )
                                      })}
                                    {userAssignments.length > 2 ? (
                                      <Badge
                                        variant="outline"
                                        className="rounded-full"
                                      >
                                        +{userAssignments.length - 2}
                                      </Badge>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    No staff role
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="pr-4 text-right sm:pr-6">
                                <UserActions
                                  user={user}
                                  isOnlyRootAdmin={isLastRootAdmin(
                                    user.id,
                                    assignments
                                  )}
                                  onView={() => openDetail(user)}
                                  onEdit={() => openEditUser(user)}
                                  onToggle={() => toggleUserStatus(user)}
                                  onNotice={setNotice}
                                />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
                      <p
                        className="text-sm text-muted-foreground"
                        aria-live="polite"
                      >
                        Showing{" "}
                        <span className="tabular-nums">
                          {startIndex + 1}–
                          {Math.min(
                            startIndex + PAGE_SIZE,
                            filteredUsers.length
                          )}
                        </span>{" "}
                        of{" "}
                        <span className="tabular-nums">
                          {filteredUsers.length}
                        </span>{" "}
                        users
                      </p>

                      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                        <PaginationContent>
                          <PaginationItem>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPage(Math.max(1, currentPage - 1))
                              }
                              disabled={currentPage === 1}
                              aria-label="Go to previous page"
                            >
                              Previous
                            </Button>
                          </PaginationItem>

                          {showLeftEllipsis ? (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : null}

                          {pages.map((pageNumber) => {
                            const isActive = pageNumber === currentPage
                            return (
                              <PaginationItem key={pageNumber}>
                                <Button
                                  variant={isActive ? "outline" : "ghost"}
                                  size="icon-sm"
                                  onClick={() => setPage(pageNumber)}
                                  aria-current={isActive ? "page" : undefined}
                                  aria-label={`Go to page ${pageNumber}`}
                                  className="tabular-nums"
                                >
                                  {pageNumber}
                                </Button>
                              </PaginationItem>
                            )
                          })}

                          {showRightEllipsis ? (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : null}

                          <PaginationItem>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPage(
                                  Math.min(totalUserPages, currentPage + 1)
                                )
                              }
                              disabled={currentPage === totalUserPages}
                              aria-label="Go to next page"
                            >
                              Next
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  </>
                )}
              </Card>
            </>
          ) : activeTab === "roles" ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard
                  icon={<ShieldCheckIcon aria-hidden="true" />}
                  value={rolesSummary.total}
                  label="Roles"
                  hint={`${rolesSummary.system} built-in`}
                />
                <SummaryCard
                  icon={<LockIcon aria-hidden="true" />}
                  value={rolesSummary.system}
                  label="Built-in"
                  hint="Cannot be deleted"
                />
                <SummaryCard
                  icon={<PencilIcon aria-hidden="true" />}
                  value={rolesSummary.custom}
                  label="Custom"
                  hint="Editable and removable"
                />
                <SummaryCard
                  icon={<UserPlusIcon aria-hidden="true" />}
                  value={rolesSummary.unassigned}
                  label="Unassigned"
                  hint="No user has this role"
                />
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
                <LockIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{SYSTEM_ROLE_NOTE}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-sm font-semibold">Role catalogue</h2>
                  <p className="text-xs text-muted-foreground">
                    Each role grants a set of permission codes.
                  </p>
                </div>
                <Button onClick={openCreateRole}>
                  <PlusIcon data-icon="inline-start" />
                  New role
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {roles.map((role) => {
                  const assignedUsers = assignments.filter(
                    (assignment) => assignment.roleId === role.id
                  )
                  const assignedNames = [
                    ...new Set(
                      assignedUsers.map(
                        (assignment) =>
                          users.find((user) => user.id === assignment.userId)
                            ?.fullName ?? "Unknown user"
                      )
                    ),
                  ]

                  return (
                    <Card key={role.id} size="sm" className="gap-3">
                      <CardHeader className="flex flex-row items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <CardTitle className="flex flex-wrap items-center gap-2">
                            {role.name}
                            {role.isSystem ? (
                              <Badge variant="outline" className="rounded-full">
                                <LockIcon aria-hidden="true" />
                                Built-in
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                              >
                                Custom
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>{role.description}</CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${role.name}`}
                              />
                            }
                          >
                            <EllipsisVerticalIcon
                              className="size-4"
                              aria-hidden="true"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>{role.name}</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openEditRole(role)}
                              >
                                <PencilIcon aria-hidden="true" />
                                Edit permissions (demo)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setNotice(
                                    `A duplicate of “${role.name}” would be created. Local demo only — nothing was saved.`
                                  )
                                }
                              >
                                <PlusIcon aria-hidden="true" />
                                Duplicate role (demo)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={role.isSystem}
                                onClick={() => deleteRole(role)}
                              >
                                <Trash2Icon aria-hidden="true" />
                                {role.isSystem
                                  ? "Delete — built-in role"
                                  : "Delete role"}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>

                      <CardContent className="gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="secondary" className="rounded-full">
                            <KeyRoundIcon aria-hidden="true" />
                            {role.permissionCodes.length} permissions
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            <UsersIcon aria-hidden="true" />
                            {assignedNames.length}{" "}
                            {assignedNames.length === 1 ? "user" : "users"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {role.permissionCodes.slice(0, 4).map((code) => (
                            <code
                              key={code}
                              className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {code}
                            </code>
                          ))}
                          {role.permissionCodes.length > 4 ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              +{role.permissionCodes.length - 4} more
                            </span>
                          ) : null}
                        </div>
                      </CardContent>

                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 text-xs text-muted-foreground">
                        <span className="truncate">
                          {assignedNames.length > 0
                            ? `Assigned to ${assignedNames.slice(0, 3).join(", ")}${assignedNames.length > 3 ? ` and ${assignedNames.length - 3} more` : ""}`
                            : "No user assigned"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditRole(role)}
                        >
                          Edit permissions
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </>
          ) : activeTab === "assignments" ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard
                  icon={<UserPlusIcon aria-hidden="true" />}
                  value={assignments.length}
                  label="Assignments"
                  hint="User × role × branch"
                />
                <SummaryCard
                  icon={<Building2Icon aria-hidden="true" />}
                  value={
                    assignments.filter((item) => item.branchId !== null).length
                  }
                  label="One branch"
                  hint="Scoped to a single branch"
                />
                <SummaryCard
                  icon={<ShieldCheckIcon aria-hidden="true" />}
                  value={
                    assignments.filter((item) => item.branchId === null).length
                  }
                  label="All branches"
                  hint="No branch restriction"
                />
                <SummaryCard
                  icon={<UsersIcon aria-hidden="true" />}
                  value={new Set(assignments.map((item) => item.userId)).size}
                  label="Users with a role"
                  hint="Staff and portal logins"
                />
              </div>

              <Card className="gap-0 py-0">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-0.5">
                    <CardTitle className="flex items-center gap-2">
                      <UserPlusIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Staff role assignments
                    </CardTitle>
                    <CardDescription>
                      {filteredAssignments.length} of {assignments.length}{" "}
                      assignments
                    </CardDescription>
                  </div>
                  <Button onClick={openCreateAssignment}>
                    <PlusIcon data-icon="inline-start" />
                    New assignment
                  </Button>
                </CardHeader>

                <div className="grid grid-cols-1 gap-2 border-b px-4 py-3 sm:grid-cols-2 sm:px-6">
                  <Select
                    items={roleFilterOptions}
                    value={roleScopeFilter}
                    onValueChange={(value) =>
                      setRoleScopeFilter(value ?? "all")
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Filter by role"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    items={assignmentBranchFilterOptions}
                    value={branchFilter}
                    onValueChange={(value) => setBranchFilter(value ?? "all")}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Filter by branch scope"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignmentBranchFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {filteredAssignments.length === 0 ? (
                  <EmptyState
                    icon={<UserPlusIcon aria-hidden="true" />}
                    title="No assignments match"
                    description="Try a different role or branch scope."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRoleScopeFilter("all")
                          setBranchFilter("all")
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                          User
                        </TableHead>
                        <TableHead className="text-muted-foreground">
                          Role
                        </TableHead>
                        <TableHead className="text-muted-foreground">
                          Branch scope
                        </TableHead>
                        <TableHead className="w-12 pr-4 text-right sm:pr-6">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssignments.map((assignment) => {
                        const user = users.find(
                          (item) => item.id === assignment.userId
                        )
                        const role = getRoleById(assignment.roleId, roles)
                        const isOnlyRoot =
                          assignment.roleId === ROOT_ADMIN_ROLE_ID &&
                          assignment.branchId === null &&
                          isLastRootAdmin(assignment.userId, assignments)

                        return (
                          <TableRow key={assignment.id}>
                            <TableCell className="py-3 pl-4 sm:pl-6">
                              <div className="flex items-center gap-3">
                                <Avatar size="sm">
                                  <AvatarFallback>
                                    {getInitials(user?.fullName ?? "?")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex min-w-0 flex-col gap-0.5">
                                  <span className="font-medium">
                                    {user?.fullName ?? "Unknown user"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {user?.email ?? "—"}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  variant="secondary"
                                  className="rounded-full"
                                >
                                  {role?.name ?? "Unknown role"}
                                </Badge>
                                {role?.isSystem ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-muted-foreground"
                                  >
                                    <LockIcon aria-hidden="true" />
                                    Built-in
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <BranchBadge branchId={assignment.branchId} />
                            </TableCell>
                            <TableCell className="pr-4 text-right sm:pr-6">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Actions for ${user?.fullName ?? "assignment"}`}
                                    />
                                  }
                                >
                                  <EllipsisVerticalIcon
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-56"
                                >
                                  <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                      {role?.name ?? "Assignment"}
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        openEditAssignment(assignment)
                                      }
                                    >
                                      <PencilIcon aria-hidden="true" />
                                      Change branch scope (demo)
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      disabled={isOnlyRoot}
                                      onClick={() =>
                                        removeAssignment(assignment)
                                      }
                                    >
                                      <Trash2Icon aria-hidden="true" />
                                      {isOnlyRoot
                                        ? "Remove — only root admin"
                                        : "Remove assignment"}
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}

                <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                  <InfoIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    A user holds a given role once per branch, or once for all
                    branches when no branch is chosen. Removing the last root
                    admin assignment is blocked in this demo.
                  </span>
                </div>
              </Card>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-sm font-semibold">
                    Permission catalogue
                  </h2>
                  <p className="max-w-2xl text-xs text-muted-foreground">
                    Permission codes are fixed by the platform. Roles bundle
                    them; a user's effective permissions are the union of their
                    assigned roles.
                  </p>
                </div>

                <div className="relative max-w-md">
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={permissionSearch}
                    onChange={(event) =>
                      setPermissionSearch(event.target.value)
                    }
                    placeholder="Search permission code or description"
                    aria-label="Search permissions"
                    className="pl-8"
                  />
                </div>
              </div>

              {permissionGroupsFiltered.length === 0 ? (
                <EmptyState
                  icon={<KeyRoundIcon aria-hidden="true" />}
                  title="No permissions match"
                  description="Try a different permission code or description."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPermissionSearch("")}
                    >
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {permissionGroupsFiltered.map((group) => (
                    <Card key={group.id} className="gap-0 py-0">
                      <CardHeader className="border-b px-4 py-4 sm:px-6">
                        <CardTitle className="flex items-center gap-2">
                          <KeyRoundIcon
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          {group.label}
                        </CardTitle>
                        <CardDescription>{group.description}</CardDescription>
                      </CardHeader>
                      <ul className="divide-y">
                        {group.permissions.map((permission) => {
                          const grantingRoles = getRolesWithPermission(
                            permission.code,
                            roles
                          )
                          return (
                            <li
                              key={permission.code}
                              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                            >
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <code className="text-xs font-medium">
                                  {permission.code}
                                </code>
                                <span className="text-xs text-muted-foreground">
                                  {permission.description}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {grantingRoles.length > 0 ? (
                                  grantingRoles.map((role) => (
                                    <Badge
                                      key={role.id}
                                      variant="outline"
                                      className="rounded-full"
                                    >
                                      {role.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    No role grants this
                                  </span>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  This page does not enforce authorization. It shows the role
                  and permission model so changes can be reviewed before any
                  real rules are applied.
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <UserFormDialog
        open={userDialogOpen}
        user={editingUser}
        isCreating={isCreatingUser}
        existingEmails={users.map((user) => user.email.toLowerCase())}
        existingUsernames={users.map((user) => user.username.toLowerCase())}
        isLastRootAdmin={
          editingUser ? isLastRootAdmin(editingUser.id, assignments) : false
        }
        onOpenChange={(open) => {
          setUserDialogOpen(open)
          if (!open) setEditingUserId(null)
        }}
        onSave={handleSaveUser}
      />

      <RoleEditorDialog
        open={roleDialogOpen}
        role={editingRole}
        isCreating={isCreatingRole}
        isEditor
        assignedUserNames={
          editingRole
            ? [
                ...new Set(
                  assignments
                    .filter((item) => item.roleId === editingRole.id)
                    .map(
                      (item) =>
                        users.find((user) => user.id === item.userId)
                          ?.fullName ?? "Unknown user"
                    )
                ),
              ]
            : []
        }
        existingNames={roles.map((role) => role.name.toLowerCase())}
        onOpenChange={(open) => {
          setRoleDialogOpen(open)
          if (!open) setEditingRoleId(null)
        }}
        onSave={handleSaveRole}
      />

      <AssignmentDialog
        open={assignmentDialogOpen}
        assignment={editingAssignment}
        isCreating={isCreatingAssignment}
        users={users}
        roles={roles}
        existing={assignments}
        onOpenChange={(open) => {
          setAssignmentDialogOpen(open)
          if (!open) setEditingAssignmentId(null)
        }}
        onSave={handleSaveAssignment}
      />

      <UserDetailSheet
        user={detailUser}
        roles={roles}
        assignments={assignments}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setDetailUserId(null)
        }}
        onEdit={openEditUser}
        onNotice={setNotice}
      />
    </main>
  )
}

function UserActions({
  user,
  isOnlyRootAdmin,
  onView,
  onEdit,
  onToggle,
  onNotice,
}: {
  user: UserRecord
  isOnlyRootAdmin: boolean
  onView: () => void
  onEdit: () => void
  onToggle: () => void
  onNotice: (message: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${user.fullName}`}
          />
        }
      >
        <EllipsisVerticalIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user.fullName}</DropdownMenuLabel>
          <DropdownMenuItem onClick={onView}>
            <EyeIcon aria-hidden="true" />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon aria-hidden="true" />
            Edit user (demo)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={user.status === "active" && isOnlyRootAdmin}
            onClick={onToggle}
          >
            <PowerIcon aria-hidden="true" />
            {user.status === "active"
              ? isOnlyRootAdmin
                ? "Disable — only root admin"
                : "Disable account"
              : "Enable account"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              onNotice(
                `A reset link would be sent to ${user.email}. Local demo only — no email was sent.`
              )
            }
          >
            <MailIcon aria-hidden="true" />
            Send reset link (demo)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <Trash2Icon aria-hidden="true" />
            Delete — accounts are disabled, not deleted
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TabButton({
  id,
  controls,
  isActive,
  icon,
  label,
  count,
  onClick,
}: {
  id: string
  controls: string
  isActive: boolean
  icon: ReactNode
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={controls}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      className={
        isActive
          ? "inline-flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&>svg]:size-4"
          : "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&>svg]:size-4"
      }
    >
      {icon}
      {label}
      <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
        {count}
      </span>
    </button>
  )
}

function SummaryCard({
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode
  value: number
  label: string
  hint: string
}) {
  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
        <span className="truncate text-2xl font-semibold tabular-nums">
          {value}
        </span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-5">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function UsersRolesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col rounded-xl border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
          >
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="ml-auto h-3.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
