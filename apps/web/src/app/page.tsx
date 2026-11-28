import { GraduationCapIcon } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export default function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2.5 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCapIcon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold">ECLZ</span>
          </span>
          <Link
            href="/sign-in"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <GraduationCapIcon className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Public landing page
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The ECLZ public website will be designed in a later step. Guest
            visitors do not have portal navigation, student records or account
            access here.
          </p>
          <p className="text-xs text-muted-foreground">
            UI preview only. No real sign-in, payment or messaging service is
            connected.
          </p>
          <Link
            href="/sign-in"
            className={cn(buttonVariants({ size: "sm" }), "mt-1")}
          >
            Sign in to the portal
          </Link>
        </div>
      </section>
    </main>
  )
}
