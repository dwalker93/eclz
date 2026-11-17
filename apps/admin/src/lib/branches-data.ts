/**
 * Local mock fixtures for the Branches directory.
 *
 * Mirrors `branch` (organization-scoped, one default per organization). Counts
 * are derived from the shared mock fixtures so the directory stays coherent
 * with Students, Courses and Payment Methods. Nothing here is persisted.
 */

import { courses } from "@/lib/courses-data"
import { bankAccounts } from "@/lib/payment-methods-data"
import { branches as branchSeeds, students } from "@/lib/students-data"

export type BranchRecord = {
  id: string
  name: string
  address: string | null
  phone: string | null
  isDefault: boolean
  isActive: boolean
  studentCount: number
  courseCount: number
  bankAccountCount: number
  createdAt: string
}

type BranchSeed = {
  id: string
  address: string
  phone: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

const branchMeta: BranchSeed[] = [
  {
    id: "br-colombo",
    address: "No. 120, Galle Road, Colombo 03",
    phone: "+94 11 234 5600",
    isDefault: true,
    isActive: true,
    createdAt: "2024-01-15",
  },
  {
    id: "br-kandy",
    address: "45, Peradeniya Road, Kandy",
    phone: "+94 81 220 4500",
    isDefault: false,
    isActive: true,
    createdAt: "2024-02-01",
  },
  {
    id: "br-galle",
    address: "12, Wackwella Road, Galle",
    phone: "+94 91 224 7800",
    isDefault: false,
    isActive: true,
    createdAt: "2024-03-10",
  },
  {
    id: "br-negombo",
    address: "78, Main Street, Negombo",
    phone: "+94 31 223 1900",
    isDefault: false,
    isActive: true,
    createdAt: "2024-06-05",
  },
  {
    id: "br-jaffna",
    address: "150, Hospital Road, Jaffna",
    phone: "+94 21 222 3400",
    isDefault: false,
    isActive: true,
    createdAt: "2025-01-20",
  },
]

function countStudents(branchId: string) {
  return students.filter((student) =>
    student.branches.some((branch) => branch.branchId === branchId)
  ).length
}

function countCourses(branchId: string) {
  return courses.filter((course) => course.branchId === branchId).length
}

function countBankAccounts(branchId: string) {
  return bankAccounts.filter((account) => account.branchId === branchId).length
}

export const branches: BranchRecord[] = branchMeta.map((seed) => {
  const branch = branchSeeds.find((item) => item.id === seed.id)

  return {
    id: seed.id,
    name: branch?.name ?? seed.id,
    address: seed.address,
    phone: seed.phone,
    isDefault: seed.isDefault,
    isActive: seed.isActive,
    studentCount: countStudents(seed.id),
    courseCount: countCourses(seed.id),
    bankAccountCount: countBankAccounts(seed.id),
    createdAt: seed.createdAt,
  }
})

export function getBranchById(branchId: string) {
  return branches.find((branch) => branch.id === branchId)
}

/** A branch with any linked records cannot be deleted in the demo. */
export function branchHasDependents(branch: BranchRecord) {
  return (
    branch.studentCount > 0 ||
    branch.courseCount > 0 ||
    branch.bankAccountCount > 0
  )
}

export function getBranchDependents(branch: BranchRecord) {
  return [
    { label: "students", count: branch.studentCount },
    { label: "courses", count: branch.courseCount },
    { label: "bank accounts", count: branch.bankAccountCount },
  ].filter((entry) => entry.count > 0)
}

export function getBranchesSummary() {
  return {
    total: branches.length,
    active: branches.filter((branch) => branch.isActive).length,
    inactive: branches.filter((branch) => !branch.isActive).length,
    defaultBranch:
      branches.find((branch) => branch.isDefault)?.name ?? "Not set",
    students: branches.reduce(
      (total, branch) => total + branch.studentCount,
      0
    ),
    courses: branches.reduce((total, branch) => total + branch.courseCount, 0),
    bankAccounts: branches.reduce(
      (total, branch) => total + branch.bankAccountCount,
      0
    ),
  }
}

export const branchScopeSummary =
  "Branches scope courses, students, invoices, payments, receipts and bank accounts."
