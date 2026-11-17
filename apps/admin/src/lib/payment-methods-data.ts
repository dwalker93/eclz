/**
 * Local mock fixtures for the Payment Methods settings screen.
 *
 * Mirrors `payment_method` (organization-scoped offered methods with enabled and
 * default flags) and `bank_account` (branch-scoped destinations). Account
 * numbers are stored so the page can mask them by default and reveal on demand.
 * `config` is a free-form jsonb, summarised here without any secret values.
 * Nothing here is persisted.
 */

import {
  paymentDirectory,
  paymentMethodLabels,
  type PaymentMethodType,
} from "@/lib/payments-data"
import { branches } from "@/lib/students-data"

export type PaymentMethodSetting = {
  id: string
  type: PaymentMethodType
  label: string
  isDefault: boolean
  isActive: boolean
  /** Presentation-only summary of the `config` jsonb. Never a secret value. */
  configSummary: string | null
}

export type BankAccountSetting = {
  id: string
  branchId: string
  branchName: string
  bankName: string
  bankBranchName: string
  accountName: string
  accountNumber: string
  isActive: boolean
  /** Presentation-only: the branch's preferred destination for bank transfers. */
  isPrimary: boolean
}

export const paymentMethodDescriptions: Record<PaymentMethodType, string> = {
  bank_transfer:
    "Students and guardians transfer to a branch bank account and upload a slip for verification.",
  cash: "Recorded at the front desk and treated as immediately verified.",
  gateway:
    "Card or online checkout through the payment provider. Provider credentials live in Integrations.",
}

function usageCountFor(type: PaymentMethodType) {
  return paymentDirectory.filter((payment) => payment.method === type).length
}

export const paymentMethodSettings: PaymentMethodSetting[] = [
  {
    id: "pm-bank-transfer",
    type: "bank_transfer",
    label: paymentMethodLabels.bank_transfer,
    isDefault: true,
    isActive: true,
    configSummary: "Default destination: Commercial Bank of Ceylon · Colombo 03",
  },
  {
    id: "pm-cash",
    type: "cash",
    label: paymentMethodLabels.cash,
    isDefault: false,
    isActive: true,
    configSummary: "Verified immediately at the front desk.",
  },
  {
    id: "pm-gateway",
    type: "gateway",
    label: paymentMethodLabels.gateway,
    isDefault: false,
    isActive: true,
    configSummary: "Provider: SamplePay · Sandbox mode",
  },
]

export function getMethodUsageCount(type: PaymentMethodType) {
  return usageCountFor(type)
}

const bankAccountSeeds: BankAccountSetting[] = [
  {
    id: "ba-colombo",
    branchId: "br-colombo",
    branchName: "Colombo",
    bankName: "Commercial Bank of Ceylon",
    bankBranchName: "Colombo 03",
    accountName: "Eclz Institute (Pvt) Ltd",
    accountNumber: "8001234567",
    isActive: true,
    isPrimary: true,
  },
  {
    id: "ba-colombo-2",
    branchId: "br-colombo",
    branchName: "Colombo",
    bankName: "Sampath Bank",
    bankBranchName: "Colombo 07",
    accountName: "Eclz Institute (Pvt) Ltd",
    accountNumber: "0009876543",
    isActive: false,
    isPrimary: false,
  },
  {
    id: "ba-kandy",
    branchId: "br-kandy",
    branchName: "Kandy",
    bankName: "Sampath Bank",
    bankBranchName: "Kandy",
    accountName: "Eclz Institute (Pvt) Ltd",
    accountNumber: "0012348821",
    isActive: true,
    isPrimary: true,
  },
  {
    id: "ba-galle",
    branchId: "br-galle",
    branchName: "Galle",
    bankName: "Hatton National Bank",
    bankBranchName: "Galle Fort",
    accountName: "Eclz Institute (Pvt) Ltd",
    accountNumber: "0012333390",
    isActive: true,
    isPrimary: true,
  },
  {
    id: "ba-negombo",
    branchId: "br-negombo",
    branchName: "Negombo",
    bankName: "Commercial Bank of Ceylon",
    bankBranchName: "Negombo",
    accountName: "Eclz Institute (Pvt) Ltd",
    accountNumber: "8001777712",
    isActive: true,
    isPrimary: true,
  },
  {
    id: "ba-jaffna",
    branchId: "br-jaffna",
    branchName: "Jaffna",
    bankName: "Bank of Ceylon",
    bankBranchName: "Jaffna Main Street",
    accountName: "Eclz Institute (Pvt) Ltd",
    accountNumber: "0077766604",
    isActive: true,
    isPrimary: true,
  },
]

export const bankAccounts: BankAccountSetting[] = [...bankAccountSeeds]

/** Everything after the last four digits becomes bullets. */
export function maskAccountNumber(accountNumber: string) {
  const digits = accountNumber.replace(/\s+/g, "")

  if (digits.length <= 4) return digits

  return `•••• •••• ${digits.slice(-4)}`
}

/** Grouped display for a revealed number, e.g. 8001 2345 67. */
export function formatAccountNumber(accountNumber: string) {
  return accountNumber
    .replace(/\s+/g, "")
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim()
}

export const bankAccountBranchOptions = [
  { value: "all", label: "All branches" },
  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
]

export function getBankAccountsForBranch(branchId: string) {
  return bankAccounts.filter((account) => account.branchId === branchId)
}

export function getPaymentMethodByType(type: PaymentMethodType) {
  return paymentMethodSettings.find((method) => method.type === type)
}

export function getDefaultBankTransferMethod() {
  return paymentMethodSettings.find(
    (method) => method.type === "bank_transfer" && method.isDefault
  )
}

export function getPaymentMethodUsageSummary() {
  return {
    offered: paymentMethodSettings.length,
    enabled: paymentMethodSettings.filter((method) => method.isActive).length,
    defaultLabel:
      paymentMethodSettings.find((method) => method.isDefault)?.label ??
      "None set",
    bankAccounts: bankAccounts.length,
    activeBankAccounts: bankAccounts.filter((account) => account.isActive).length,
    branchCount: new Set(bankAccounts.map((account) => account.branchId)).size,
  }
}
