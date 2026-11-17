/**
 * Local mock fixtures for the Users & Roles screen.
 *
 * Mirrors `user`, `role`, `permission`, `role_permission` and
 * `staff_role_assignment`. Staff logins are authored here; lecturer, guardian
 * and student portal logins are derived from the shared mock fixtures so their
 * profile badges stay in step with those screens. No password hash is modelled
 * — only sign-in metadata is shown. Nothing here is persisted.
 */

import { guardians } from "@/lib/guardians-data"
import { lecturers } from "@/lib/lecturers-data"
import { branches, students } from "@/lib/students-data"

export type UserStatus = "active" | "disabled"

export type ProfileKind = "lecturer" | "student" | "guardian"

export type LinkedProfile = {
  kind: ProfileKind
  /** Source fixture id, when the profile maps to an existing record. */
  id: string | null
  label: string
  hint: string
}

export type UserRecord = {
  id: string
  fullName: string
  email: string
  username: string
  phone: string | null
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
  /** True for logins managed on this screen; false for portal logins. */
  isStaff: boolean
  mfaEnabled: boolean
  passwordChangedAt: string | null
  profiles: LinkedProfile[]
}

export type RoleRecord = {
  id: string
  name: string
  description: string
  isSystem: boolean
  permissionCodes: string[]
}

export type PermissionRecord = {
  code: string
  description: string
}

export type PermissionGroup = {
  id: string
  label: string
  description: string
  permissions: PermissionRecord[]
}

export type StaffRoleAssignment = {
  id: string
  userId: string
  roleId: string
  /** null means all branches. */
  branchId: string | null
}

export const ROOT_ADMIN_ROLE_ID = "role-root-admin"
export const MASKED_CREDENTIAL = "••••••••••"
export const ALL_BRANCHES_VALUE = "all-branches"

export const userStatusLabels: Record<UserStatus, string> = {
  active: "Active",
  disabled: "Disabled",
}

export const profileKindLabels: Record<ProfileKind, string> = {
  lecturer: "Lecturer",
  student: "Student",
  guardian: "Guardian",
}

export const MULTI_PROFILE_NOTE =
  "One login can carry more than one profile — a staff account can also hold a lecturer, student or guardian profile. The profile records themselves live on their own screens; this page only links to them."

export const CREDENTIAL_NOTE =
  "Password hashes are never shown. Only sign-in metadata — enabled status, last login and the password change date — appears here."

export const SYSTEM_ROLE_NOTE =
  "Built-in roles cannot be deleted. Edit their permissions, or create a custom role instead."

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "students",
    label: "Students & guardians",
    description: "Student records, profiles and guardian links.",
    permissions: [
      {
        code: "students.view",
        description: "View students and their profiles.",
      },
      { code: "students.create", description: "Add new students." },
      {
        code: "students.edit",
        description: "Edit student details and status.",
      },
      {
        code: "students.delete",
        description: "Archive or delete student records.",
      },
      {
        code: "guardians.manage",
        description: "Manage guardians and student links.",
      },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    description: "Courses, timetable, attendance, exams and content.",
    permissions: [
      {
        code: "courses.manage",
        description: "Create and edit courses and classes.",
      },
      {
        code: "timetable.manage",
        description: "Manage the timetable and sessions.",
      },
      { code: "attendance.mark", description: "Mark and correct attendance." },
      { code: "exams.grade", description: "Enter and publish exam results." },
      { code: "content.manage", description: "Manage the content library." },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    description: "Fees, invoices, payments, receipts and exceptions.",
    permissions: [
      { code: "invoices.view", description: "View invoices and balances." },
      {
        code: "invoices.issue",
        description: "Create, issue and cancel invoices.",
      },
      { code: "payments.record", description: "Record and verify payments." },
      { code: "receipts.issue", description: "Issue and void receipts." },
      {
        code: "fees.override",
        description: "Override fees and apply discounts.",
      },
      {
        code: "fee_exceptions.manage",
        description: "Manage fee exceptions and alternates.",
      },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    description: "Users, roles, branches, settings and the audit trail.",
    permissions: [
      { code: "users.manage", description: "Create and edit user accounts." },
      { code: "roles.manage", description: "Manage roles and permissions." },
      { code: "branches.manage", description: "Manage branches." },
      {
        code: "settings.manage",
        description: "Change organization settings.",
      },
      { code: "audit.view", description: "View the audit log." },
    ],
  },
]

export const permissions: PermissionRecord[] = PERMISSION_GROUPS.flatMap(
  (group) => group.permissions
)

export const permissionGroupByCode: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => [permission.code, group.id] as const)
  )
)

export const allPermissionCodes = permissions.map(
  (permission) => permission.code
)

export const roles: RoleRecord[] = [
  {
    id: ROOT_ADMIN_ROLE_ID,
    name: "Root Admin",
    description:
      "Full control of the deployment. Reserved for the platform owner.",
    isSystem: true,
    permissionCodes: [...allPermissionCodes],
  },
  {
    id: "role-admin",
    name: "Administrator",
    description:
      "Runs the institute day to day, without changing roles or organization settings.",
    isSystem: true,
    permissionCodes: allPermissionCodes.filter(
      (code) => code !== "roles.manage" && code !== "settings.manage"
    ),
  },
  {
    id: "role-branch-manager",
    name: "Branch Manager",
    description: "Manages academics and front-desk finance for one branch.",
    isSystem: true,
    permissionCodes: [
      "students.view",
      "students.create",
      "students.edit",
      "guardians.manage",
      "courses.manage",
      "timetable.manage",
      "attendance.mark",
      "exams.grade",
      "content.manage",
      "invoices.view",
      "payments.record",
      "fee_exceptions.manage",
    ],
  },
  {
    id: "role-accountant",
    name: "Accountant",
    description: "Handles invoicing, payments, receipts and fee overrides.",
    isSystem: true,
    permissionCodes: [
      "students.view",
      "invoices.view",
      "invoices.issue",
      "payments.record",
      "receipts.issue",
      "fees.override",
      "fee_exceptions.manage",
    ],
  },
  {
    id: "role-lecturer",
    name: "Lecturer",
    description: "Portal access for teaching: attendance, results and content.",
    isSystem: true,
    permissionCodes: [
      "students.view",
      "timetable.manage",
      "attendance.mark",
      "exams.grade",
      "content.manage",
    ],
  },
  {
    id: "role-receptionist",
    name: "Receptionist",
    description:
      "Front desk: student intake, guardian links and counter payments.",
    isSystem: false,
    permissionCodes: [
      "students.view",
      "students.create",
      "students.edit",
      "guardians.manage",
      "invoices.view",
      "payments.record",
      "receipts.issue",
    ],
  },
  {
    id: "role-academic-coordinator",
    name: "Academic Coordinator",
    description: "Plans courses, timetable and exams across branches.",
    isSystem: false,
    permissionCodes: [
      "students.view",
      "courses.manage",
      "timetable.manage",
      "attendance.mark",
      "exams.grade",
      "content.manage",
    ],
  },
]

const staffUsers: UserRecord[] = [
  {
    id: "usr-root",
    fullName: "Dilani Weerakoon",
    email: "dilani.weerakoon@eclz.lk",
    username: "dilani.w",
    phone: "+94 77 100 0001",
    status: "active",
    lastLoginAt: "2026-11-13T08:12:00+05:30",
    createdAt: "2024-01-15",
    isStaff: true,
    mfaEnabled: true,
    passwordChangedAt: "2026-10-02",
    profiles: [],
  },
  {
    id: "usr-admin",
    fullName: "Suresh Gunasekara",
    email: "suresh.gunasekara@eclz.lk",
    username: "suresh.g",
    phone: "+94 77 100 0002",
    status: "active",
    lastLoginAt: "2026-11-12T19:30:00+05:30",
    createdAt: "2024-01-15",
    isStaff: true,
    mfaEnabled: true,
    passwordChangedAt: "2026-09-18",
    profiles: [],
  },
  {
    id: "usr-coord",
    fullName: "Tharushi Peiris",
    email: "tharushi.peiris@eclz.lk",
    username: "tharushi.p",
    phone: "+94 77 100 0003",
    status: "active",
    lastLoginAt: "2026-11-13T07:05:00+05:30",
    createdAt: "2024-02-01",
    isStaff: true,
    mfaEnabled: false,
    passwordChangedAt: "2026-08-01",
    profiles: [],
  },
  {
    id: "usr-acct",
    fullName: "Hasini Silva",
    email: "hasini.silva@eclz.lk",
    username: "hasini.s",
    phone: "+94 77 100 0004",
    status: "active",
    lastLoginAt: "2026-11-12T16:48:00+05:30",
    createdAt: "2024-02-10",
    isStaff: true,
    mfaEnabled: true,
    passwordChangedAt: "2026-10-20",
    profiles: [],
  },
  {
    id: "usr-mgr-cmb",
    fullName: "Chandana Wijeratne",
    email: "chandana.wijeratne@eclz.lk",
    username: "chandana.w",
    phone: "+94 77 100 0005",
    status: "active",
    lastLoginAt: "2026-11-13T08:05:00+05:30",
    createdAt: "2024-03-05",
    isStaff: true,
    mfaEnabled: false,
    passwordChangedAt: "2026-07-14",
    profiles: [],
  },
  {
    id: "usr-mgr-kdy",
    fullName: "Ramya Herath",
    email: "ramya.herath@eclz.lk",
    username: "ramya.h",
    phone: "+94 77 100 0006",
    status: "active",
    lastLoginAt: "2026-11-12T18:22:00+05:30",
    createdAt: "2024-03-05",
    isStaff: true,
    mfaEnabled: false,
    passwordChangedAt: "2026-06-30",
    profiles: [],
  },
  {
    id: "usr-recep",
    fullName: "Kasun Bandara",
    email: "kasun.bandara@eclz.lk",
    username: "kasun.b",
    phone: "+94 77 100 0007",
    status: "active",
    lastLoginAt: "2026-11-13T08:40:00+05:30",
    createdAt: "2025-01-10",
    isStaff: true,
    mfaEnabled: false,
    passwordChangedAt: "2026-05-02",
    profiles: [],
  },
  {
    id: "usr-nm",
    fullName: "Mohamed Aslam",
    email: "mohamed.aslam@eclz.lk",
    username: "mohamed.a",
    phone: "+94 77 100 0008",
    status: "disabled",
    lastLoginAt: "2026-06-30T15:10:00+05:30",
    createdAt: "2025-02-14",
    isStaff: true,
    mfaEnabled: false,
    passwordChangedAt: "2025-02-14",
    profiles: [],
  },
]

export function getStudentById(studentId: string) {
  return students.find((student) => student.id === studentId)
}

const profileLinks: Record<string, LinkedProfile[]> = {}

function addProfileLink(userId: string, profile: LinkedProfile) {
  const list = profileLinks[userId] ?? []
  list.push(profile)
  profileLinks[userId] = list
}

const derivedUsers: UserRecord[] = []

for (const lecturer of lecturers) {
  if (!lecturer.userId) continue

  addProfileLink(lecturer.userId, {
    kind: "lecturer",
    id: lecturer.id,
    label: "Lecturer profile",
    hint: lecturer.qualification,
  })

  derivedUsers.push({
    id: lecturer.userId,
    fullName: lecturer.fullName,
    email: lecturer.accountEmail ?? `${lecturer.id}@eclz.lk`,
    username: lecturer.accountUsername ?? lecturer.id,
    phone: null,
    status: "active",
    lastLoginAt: lecturer.lastLoginAt,
    createdAt: lecturer.createdAt,
    isStaff: false,
    mfaEnabled: false,
    passwordChangedAt: lecturer.createdAt,
    profiles: [],
  })
}

for (const guardian of guardians) {
  if (!guardian.userId) continue

  const linkedNames = guardian.links
    .map((link) => getStudentById(link.studentId)?.fullName)
    .filter((name): name is string => Boolean(name))

  addProfileLink(guardian.userId, {
    kind: "guardian",
    id: guardian.id,
    label: "Guardian profile",
    hint: linkedNames.length
      ? `Linked to ${linkedNames.join(", ")}`
      : "No linked students yet",
  })

  const accountEmail =
    guardian.accountEmail ?? guardian.email ?? `${guardian.id}@eclz.lk`

  derivedUsers.push({
    id: guardian.userId,
    fullName: guardian.fullName,
    email: accountEmail,
    username: accountEmail.split("@")[0] ?? guardian.id,
    phone: guardian.phone,
    status: guardian.portalEnabled ? "active" : "disabled",
    lastLoginAt: guardian.lastLoginAt,
    createdAt: guardian.createdAt,
    isStaff: false,
    mfaEnabled: false,
    passwordChangedAt: guardian.createdAt,
    profiles: [],
  })
}

for (const student of students) {
  if (!student.portalLinked || !student.portalEmail) continue

  const userId = `usr-${student.id}`

  addProfileLink(userId, {
    kind: "student",
    id: student.id,
    label: "Student portal",
    hint: `${student.studentNo} · ${student.fullName}`,
  })

  derivedUsers.push({
    id: userId,
    fullName: student.fullName,
    email: student.portalEmail,
    username: student.portalEmail.split("@")[0] ?? student.id,
    phone: student.contactPhone,
    status: student.status === "suspended" ? "disabled" : "active",
    lastLoginAt: null,
    createdAt: student.createdAt,
    isStaff: false,
    mfaEnabled: false,
    passwordChangedAt: student.createdAt,
    profiles: [],
  })
}

/**
 * One login can carry more than one profile. Sample: a guardian account that
 * also teaches part-time. The extra badge is illustrative only — it does not
 * point at a second record.
 */
const extraProfileLinks: Record<string, LinkedProfile[]> = {
  "usr-gu-12": [
    {
      kind: "lecturer",
      id: null,
      label: "Lecturer profile",
      hint: "Also teaches part-time. One login can carry several profiles.",
    },
  ],
}

export const users: UserRecord[] = [...staffUsers, ...derivedUsers].map(
  (user) => ({
    ...user,
    profiles: [
      ...(profileLinks[user.id] ?? []),
      ...(extraProfileLinks[user.id] ?? []),
    ],
  })
)

const lecturerAssignments: StaffRoleAssignment[] = lecturers
  .filter((lecturer) => lecturer.userId)
  .map((lecturer, index) => ({
    id: `sra-lec-${index + 1}`,
    userId: lecturer.userId as string,
    roleId: "role-lecturer",
    branchId: null,
  }))

export const staffRoleAssignments: StaffRoleAssignment[] = [
  {
    id: "sra-1",
    userId: "usr-root",
    roleId: ROOT_ADMIN_ROLE_ID,
    branchId: null,
  },
  { id: "sra-2", userId: "usr-admin", roleId: "role-admin", branchId: null },
  {
    id: "sra-3",
    userId: "usr-coord",
    roleId: "role-academic-coordinator",
    branchId: null,
  },
  {
    id: "sra-4",
    userId: "usr-acct",
    roleId: "role-accountant",
    branchId: null,
  },
  {
    id: "sra-5",
    userId: "usr-mgr-cmb",
    roleId: "role-branch-manager",
    branchId: "br-colombo",
  },
  {
    id: "sra-6",
    userId: "usr-mgr-kdy",
    roleId: "role-branch-manager",
    branchId: "br-kandy",
  },
  {
    id: "sra-7",
    userId: "usr-recep",
    roleId: "role-receptionist",
    branchId: "br-colombo",
  },
  {
    id: "sra-8",
    userId: "usr-nm",
    roleId: "role-receptionist",
    branchId: "br-negombo",
  },
  // A lecturer who also coordinates the mathematics course group.
  {
    id: "sra-9",
    userId: "usr-1",
    roleId: "role-academic-coordinator",
    branchId: "br-colombo",
  },
  ...lecturerAssignments,
]

export function getUserById(userId: string, list: UserRecord[] = users) {
  return list.find((user) => user.id === userId)
}

export function getRoleById(roleId: string, list: RoleRecord[] = roles) {
  return list.find((role) => role.id === roleId)
}

export function getBranchName(branchId: string | null) {
  if (!branchId) return "All branches"

  return (
    branches.find((branch) => branch.id === branchId)?.name ?? "Unknown branch"
  )
}

export function getAssignmentsForUser(
  userId: string,
  list: StaffRoleAssignment[] = staffRoleAssignments
) {
  return list.filter((assignment) => assignment.userId === userId)
}

export function getUsersForRole(
  roleId: string,
  list: StaffRoleAssignment[] = staffRoleAssignments
) {
  return list.filter((assignment) => assignment.roleId === roleId)
}

export function getRoleUserCount(
  roleId: string,
  list: StaffRoleAssignment[] = staffRoleAssignments
) {
  return new Set(getUsersForRole(roleId, list).map((item) => item.userId)).size
}

export function getRoleNamesForUser(
  userId: string,
  roleList: RoleRecord[] = roles,
  assignmentList: StaffRoleAssignment[] = staffRoleAssignments
) {
  return getAssignmentsForUser(userId, assignmentList)
    .map((assignment) => getRoleById(assignment.roleId, roleList)?.name)
    .filter((name): name is string => Boolean(name))
}

export function getRootAdminUserIds(
  list: StaffRoleAssignment[] = staffRoleAssignments
) {
  return list
    .filter(
      (assignment) =>
        assignment.roleId === ROOT_ADMIN_ROLE_ID && assignment.branchId === null
    )
    .map((assignment) => assignment.userId)
}

export function isRootAdmin(
  userId: string,
  list: StaffRoleAssignment[] = staffRoleAssignments
) {
  return getRootAdminUserIds(list).includes(userId)
}

export function isLastRootAdmin(
  userId: string,
  list: StaffRoleAssignment[] = staffRoleAssignments
) {
  const ids = getRootAdminUserIds(list)

  return ids.length === 1 && ids[0] === userId
}

export function getPermissionByCode(code: string) {
  return permissions.find((permission) => permission.code === code)
}

export function getPermissionGroupLabel(code: string) {
  const groupId = permissionGroupByCode[code]

  return (
    PERMISSION_GROUPS.find((group) => group.id === groupId)?.label ?? "Other"
  )
}

export function roleHasPermission(role: RoleRecord, code: string) {
  return role.permissionCodes.includes(code)
}

export function getRolesWithPermission(
  code: string,
  roleList: RoleRecord[] = roles
) {
  return roleList.filter((role) => roleHasPermission(role, code))
}

export function getUsersSummary(list: UserRecord[] = users) {
  return {
    total: list.length,
    active: list.filter((user) => user.status === "active").length,
    disabled: list.filter((user) => user.status === "disabled").length,
    staff: list.filter((user) => user.isStaff).length,
    withPortalProfiles: list.filter((user) => user.profiles.length > 0).length,
  }
}

export function getRolesSummary(
  roleList: RoleRecord[] = roles,
  assignmentList: StaffRoleAssignment[] = staffRoleAssignments
) {
  return {
    total: roleList.length,
    system: roleList.filter((role) => role.isSystem).length,
    custom: roleList.filter((role) => !role.isSystem).length,
    unassigned: roleList.filter(
      (role) => getRoleUserCount(role.id, assignmentList) === 0
    ).length,
  }
}

export const userStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
]

export const userKindFilterOptions = [
  { value: "all", label: "All logins" },
  { value: "staff", label: "Staff logins" },
  { value: "portal", label: "Portal logins" },
  { value: "linked", label: "Has profile links" },
]

export const roleFilterOptions = [
  { value: "all", label: "All roles" },
  ...roles.map((role) => ({ value: role.id, label: role.name })),
]

export const assignmentBranchFilterOptions = [
  { value: "all", label: "Any branch" },
  { value: "all-branches", label: "All-branches roles" },
  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
]

export const assignmentBranchOptions = [
  { value: ALL_BRANCHES_VALUE, label: "All branches" },
  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
]
