"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowLeftIcon,
  CheckCheckIcon,
  EyeIcon,
  EyeOffIcon,
  GraduationCapIcon,
  InfoIcon,
  LogInIcon,
  TriangleAlertIcon,
} from "lucide-react"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = {
  identifier?: string
  password?: string
}

export function SignIn() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [confirmed, setConfirmed] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: FieldErrors = {}
    const trimmed = identifier.trim()

    if (!trimmed) {
      nextErrors.identifier = "Enter your email address or username."
    } else if (trimmed.includes("@") && !EMAIL_PATTERN.test(trimmed)) {
      nextErrors.identifier = "Enter a valid email address."
    }

    if (!password) {
      nextErrors.password = "Enter your password."
    }

    setErrors(nextErrors)
    setConfirmed(Object.keys(nextErrors).length === 0)
  }

  function editField(update: () => void) {
    // Editing after a confirmation clears the local success state so it always
    // reflects the current input.
    setConfirmed(false)
    update()
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCapIcon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold">ECLZ</span>
          </Link>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="flex w-full max-w-md flex-col gap-4">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-5 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  Public portal
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  Demo only
                </Badge>
              </div>
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>
                Students, lecturers and guardians all sign in here. Portal
                access depends on your linked role and the institute&apos;s
                enabled settings.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5">
              <form
                noValidate
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sign-in-identifier">Email or username</Label>
                  <Input
                    id="sign-in-identifier"
                    name="identifier"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={identifier}
                    onChange={(event) =>
                      editField(() => setIdentifier(event.target.value))
                    }
                    aria-invalid={Boolean(errors.identifier)}
                    aria-describedby={
                      errors.identifier ? "sign-in-identifier-error" : undefined
                    }
                    placeholder="name@example.com"
                  />
                  {errors.identifier ? (
                    <p
                      id="sign-in-identifier-error"
                      className="flex items-center gap-1.5 text-xs text-destructive"
                    >
                      <TriangleAlertIcon
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {errors.identifier}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="sign-in-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="sign-in-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) =>
                        editField(() => setPassword(event.target.value))
                      }
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={
                        errors.password ? "sign-in-password-error" : undefined
                      }
                      placeholder="Your password"
                      className="pr-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      className="absolute top-1/2 right-1 -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOffIcon aria-hidden="true" />
                      ) : (
                        <EyeIcon aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  {errors.password ? (
                    <p
                      id="sign-in-password-error"
                      className="flex items-center gap-1.5 text-xs text-destructive"
                    >
                      <TriangleAlertIcon
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {errors.password}
                    </p>
                  ) : null}
                </div>

                {confirmed ? (
                  <p
                    role="status"
                    className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400"
                  >
                    <CheckCheckIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Details checked locally. This is a UI preview — no account
                      was looked up, no session was created and no portal page
                      is opened.
                    </span>
                  </p>
                ) : null}

                <Button type="submit" className="w-full">
                  <LogInIcon data-icon="inline-start" aria-hidden="true" />
                  Sign in
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-4 text-xs text-muted-foreground">
              <span>
                Password reset and public sign-up are not part of this preview.
              </span>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "link", size: "xs" }))}
              >
                Continue as guest
              </Link>
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0">
            <CardContent className="flex items-start gap-3 p-4">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                This page is a visual mock. It does not authenticate anyone,
                store credentials or create a session, and it never opens a
                portal page. Please do not enter real credentials.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
