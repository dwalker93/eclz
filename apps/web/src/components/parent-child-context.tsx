"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { parentChildren, type ParentChild } from "@/lib/parent-portal-data"

const STORAGE_KEY = "eclz.parent-portal.selected-child"

type ParentChildContextValue = {
  /** Only the students linked to this guardian record. */
  children: ParentChild[]
  selectedChild: ParentChild | null
  selectedChildId: string
  selectChild: (childId: string) => void
}

const ParentChildContext = createContext<ParentChildContextValue | null>(null)

function getFallbackChildId() {
  return parentChildren[0]?.id ?? ""
}

function readStoredChildId() {
  if (typeof window === "undefined") return null

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored && parentChildren.some((child) => child.id === stored)
      ? stored
      : null
  } catch {
    return null
  }
}

/**
 * Parent-portal-only selection state. The choice is shared by the header
 * switcher and every parent page, and survives navigation and reloads through
 * local browser storage. No database, API or auth state is involved.
 */
export function ParentChildProvider({ children }: { children: ReactNode }) {
  const [selectedChildId, setSelectedChildId] = useState(getFallbackChildId)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readStoredChildId()
    if (stored) setSelectedChildId(stored)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return

    try {
      window.localStorage.setItem(STORAGE_KEY, selectedChildId)
    } catch {
      // Local demo state: ignore unavailable storage.
    }
  }, [hydrated, selectedChildId])

  const selectChild = useCallback((childId: string) => {
    if (parentChildren.some((child) => child.id === childId)) {
      setSelectedChildId(childId)
    }
  }, [])

  const selectedChild = useMemo(
    () =>
      parentChildren.find((child) => child.id === selectedChildId) ??
      parentChildren[0] ??
      null,
    [selectedChildId]
  )

  const value = useMemo<ParentChildContextValue>(
    () => ({
      children: parentChildren,
      selectedChild,
      selectedChildId: selectedChild?.id ?? "",
      selectChild,
    }),
    [selectedChild, selectChild]
  )

  return (
    <ParentChildContext.Provider value={value}>
      {children}
    </ParentChildContext.Provider>
  )
}

export function useParentChild() {
  const context = useContext(ParentChildContext)

  if (!context) {
    throw new Error("useParentChild must be used within ParentChildProvider")
  }

  return context
}
