"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  ImageIcon,
  InfoIcon,
  ListChecksIcon,
  LockIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  SearchIcon,
  SnowflakeIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react"

import { QuestionDetailSheet } from "@/components/question-bank/question-detail-sheet"
import { QuestionFormDialog } from "@/components/question-bank/question-form-dialog"
import { usePagination } from "@/hooks/use-pagination"
import {
  getQuestionUsage,
  isQuestionInPublishedSnapshot,
} from "@/lib/exams-data"
import {
  questionLecturerFilterOptions,
  questionSubjectFilterOptions,
  questions,
  type QuestionRecord,
} from "@/lib/questions-data"
import { formatDisplayDate } from "@/lib/students-data"

const PAGE_SIZE = 8

const ONLINE_EXAMS_MODULE_MOCK = {
  label: "Online exams module",
  hint: "The question bank is shared by online MCQ exams. It is optional and only needed when the online exams module is on.",
}

export function QuestionBankDirectory() {
  const [moduleEnabled, setModuleEnabled] = useState(true)
  const [search, setSearch] = useState("")
  const [lecturerFilter, setLecturerFilter] = useState("all")
  const [subjectFilter, setSubjectFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionRecord | null>(
    null
  )
  const [selectedQuestion, setSelectedQuestion] =
    useState<QuestionRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, lecturerFilter, subjectFilter])

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Question bank refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const summary = useMemo(
    () => ({
      total: questions.length,
      withImages: questions.filter((question) => question.imageFileName).length,
      multiCorrect: questions.filter(
        (question) =>
          question.options.filter((option) => option.isCorrect).length > 1
      ).length,
      frozen: questions.filter((question) =>
        isQuestionInPublishedSnapshot(question.id)
      ).length,
    }),
    []
  )

  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase()

    return questions.filter((question) => {
      const matchesSearch =
        query.length === 0 ||
        question.body.toLowerCase().includes(query) ||
        question.subjectName.toLowerCase().includes(query) ||
        question.lecturerName.toLowerCase().includes(query) ||
        question.options.some((option) =>
          option.body.toLowerCase().includes(query)
        )

      const matchesLecturer =
        lecturerFilter === "all" || question.lecturerId === lecturerFilter
      const matchesSubject =
        subjectFilter === "all" || question.subjectName === subjectFilter

      return matchesSearch && matchesLecturer && matchesSubject
    })
  }, [search, lecturerFilter, subjectFilter])

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleQuestions = filteredQuestions.slice(
    startIndex,
    startIndex + PAGE_SIZE
  )

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters =
    search.length > 0 || lecturerFilter !== "all" || subjectFilter !== "all"

  function clearFilters() {
    setSearch("")
    setLecturerFilter("all")
    setSubjectFilter("all")
  }

  function openCreate() {
    setEditingQuestion(null)
    setFormOpen(true)
  }

  function openEdit(question: QuestionRecord) {
    setEditingQuestion(question)
    setDetailOpen(false)
    setFormOpen(true)
  }

  function openDetail(question: QuestionRecord) {
    setSelectedQuestion(question)
    setDetailOpen(true)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Question Bank
              <Badge variant="outline" className="rounded-full">
                <ListChecksIcon aria-hidden="true" />
                Optional module
              </Badge>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Lecturer-owned questions and their ordered answer options. Exams
              draw from this bank; all records here are sample data and nothing is
              saved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setNotice(
                  "Export is a placeholder in this UI demo. No file was generated."
                )
              }
            >
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
            <Button onClick={openCreate} disabled={!moduleEnabled}>
              <PlusIcon data-icon="inline-start" />
              Add question
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

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <PowerIcon className="size-4" aria-hidden="true" />
                {ONLINE_EXAMS_MODULE_MOCK.label}
              </CardTitle>
              <CardDescription>
                {ONLINE_EXAMS_MODULE_MOCK.hint}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {moduleEnabled ? "Enabled" : "Disabled"}
              </span>
              <Switch
                checked={moduleEnabled}
                onCheckedChange={(checked) => {
                  setModuleEnabled(checked)
                  setNotice(
                    checked
                      ? "Online exams module switched on in this preview. The question bank is available."
                      : "Online exams module switched off in this preview. The bank is hidden, but no question is deleted."
                  )
                }}
                aria-label="Enable the online exams module"
              />
            </div>
          </CardHeader>
        </Card>

        {!moduleEnabled ? (
          <Card className="py-0">
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ListChecksIcon className="size-6" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-medium">
                  Online exams module is off
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  The Question Bank is optional and only used by online MCQ
                  exams. Switching the module off hides this screen; sample
                  questions are kept as-is.
                </p>
              </div>
              <Button variant="outline" onClick={() => setModuleEnabled(true)}>
                <PowerIcon data-icon="inline-start" />
                Turn module back on
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {isRefreshing ? null : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard
                  icon={<ListChecksIcon aria-hidden="true" />}
                  value={summary.total}
                  label="Questions"
                  hint="Shared across all exams"
                />
                <SummaryCard
                  icon={<ImageIcon aria-hidden="true" />}
                  value={summary.withImages}
                  label="With image"
                  hint="Prompt diagrams attached"
                />
                <SummaryCard
                  icon={<CheckIcon aria-hidden="true" />}
                  value={summary.multiCorrect}
                  label="Multi-answer"
                  hint="More than one correct option"
                />
                <SummaryCard
                  icon={<SnowflakeIcon aria-hidden="true" />}
                  value={summary.frozen}
                  label="In a snapshot"
                  hint="Frozen into a published exam"
                />
              </div>
            )}

            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-0.5">
                  <CardTitle>All questions</CardTitle>
                  <CardDescription>
                    {filteredQuestions.length}{" "}
                    {filteredQuestions.length === 1 ? "question" : "questions"}{" "}
                    match the current filters.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRefreshing(true)}
                  disabled={isRefreshing}
                >
                  <RefreshCwIcon
                    data-icon="inline-start"
                    className={isRefreshing ? "animate-spin" : undefined}
                  />
                  {isRefreshing ? "Refreshing" : "Refresh"}
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
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search question text, options, lecturer or subject"
                      aria-label="Search questions"
                      className="pl-8"
                    />
                  </div>

                  <Select
                    items={questionLecturerFilterOptions}
                    value={lecturerFilter}
                    onValueChange={(value) => setLecturerFilter(value ?? "all")}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Filter by lecturer"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {questionLecturerFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    items={questionSubjectFilterOptions}
                    value={subjectFilter}
                    onValueChange={(value) => setSubjectFilter(value ?? "all")}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Filter by subject"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {questionSubjectFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="justify-self-start"
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                      Question
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Subject
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Options
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Default marks
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Snapshot
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Created
                    </TableHead>
                    <TableHead className="w-12 pr-4 text-right sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRefreshing ? (
                    <QuestionTableSkeleton />
                  ) : visibleQuestions.length > 0 ? (
                    visibleQuestions.map((question) => {
                      const correctCount = question.options.filter(
                        (option) => option.isCorrect
                      ).length
                      const usage = getQuestionUsage(question.id)
                      const frozen = usage.some((item) => item.frozen)

                      return (
                        <TableRow key={question.id}>
                          <TableCell className="py-3 pl-4 sm:pl-6">
                            <div className="flex max-w-[360px] items-start gap-2">
                              <button
                                type="button"
                                onClick={() => openDetail(question)}
                                className="flex min-w-0 flex-col text-left focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                              >
                                <span className="line-clamp-2 font-medium text-card-foreground hover:underline">
                                  {question.body}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {question.lecturerName}
                                </span>
                              </button>
                              {question.imageFileName ? (
                                <span
                                  className="mt-0.5 shrink-0 text-muted-foreground"
                                  title={`Image attached: ${question.imageFileName}`}
                                >
                                  <ImageIcon
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">
                                    Image attached
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="rounded-full">
                              {question.subjectName}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            <span className="tabular-nums">
                              {question.options.length}
                            </span>{" "}
                            options
                            <span className="block text-xs">
                              {correctCount} correct
                            </span>
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {question.defaultMarks}{" "}
                            {question.defaultMarks === 1 ? "mark" : "marks"}
                          </TableCell>

                          <TableCell>
                            {frozen ? (
                              <Badge
                                variant="outline"
                                className="rounded-full border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400"
                              >
                                <SnowflakeIcon aria-hidden="true" />
                                In snapshot
                              </Badge>
                            ) : usage.length > 0 ? (
                              <Badge
                                variant="outline"
                                className="rounded-full text-muted-foreground"
                              >
                                <LockIcon aria-hidden="true" />
                                Draft only
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-full text-muted-foreground"
                              >
                                Unused
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {formatDisplayDate(question.createdAt)}
                          </TableCell>

                          <TableCell className="pr-4 text-right sm:pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for question: ${question.body}`}
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
                                <DropdownMenuLabel className="truncate">
                                  {question.body}
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => openDetail(question)}
                                >
                                  <InfoIcon aria-hidden="true" />
                                  View details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openEdit(question)}
                                >
                                  <SquarePenIcon aria-hidden="true" />
                                  Edit bank record (demo)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled
                                >
                                  <SnowflakeIcon aria-hidden="true" />
                                  {frozen
                                    ? "Snapshot is read-only"
                                    : "No snapshot yet"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <ListChecksIcon
                              className="size-5"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium">
                              No questions match
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Try a different search term, lecturer or subject.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            disabled={!hasActiveFilters}
                          >
                            Clear filters
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {filteredQuestions.length > 0 ? (
                    <>
                      Showing{" "}
                      <span className="tabular-nums">
                        {startIndex + 1}–
                        {Math.min(
                          startIndex + PAGE_SIZE,
                          filteredQuestions.length
                        )}
                      </span>{" "}
                      of{" "}
                      <span className="tabular-nums">
                        {filteredQuestions.length}
                      </span>{" "}
                      questions
                    </>
                  ) : (
                    "No questions to show"
                  )}
                </p>

                <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        aria-label="Go to previous page"
                      >
                        <ChevronLeftIcon aria-hidden="true" />
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
                          setPage(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                        aria-label="Go to next page"
                      >
                        Next
                        <ChevronRightIcon aria-hidden="true" />
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </Card>

            <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
              <SnowflakeIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                A question used in a published exam keeps a frozen snapshot of
                itself and its options. The bank only edits the live record —
                published snapshots stay read-only, and no change made here
                rewrites them.
              </span>
            </div>
          </>
        )}
      </div>

      <QuestionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        question={editingQuestion}
        onSaved={(message) => setNotice(message)}
      />

      <QuestionDetailSheet
        question={selectedQuestion}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
      />
    </main>
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

function QuestionTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-56" />
              <Skeleton className="h-3 w-28" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell className="pr-4 sm:pr-6">
            <Skeleton className="ml-auto size-7 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}