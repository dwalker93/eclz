import { Fragment } from "react"
import type { ReactElement } from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  CirclePlusIcon,
  CreditCardIcon,
  LogOutIcon,
  SettingsIcon,
  SquarePenIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

type Props = {
  trigger: ReactElement
  defaultOpen?: boolean
  align?: "start" | "center" | "end"
}

type ProfileMenuItem = {
  icon: LucideIcon
  label: string
  variant?: "destructive"
}

const profileMenuSections: { id: string; items: ProfileMenuItem[] }[] = [
  {
    id: "account",
    items: [
      { icon: UserIcon, label: "My account" },
      { icon: SettingsIcon, label: "Settings" },
      { icon: CreditCardIcon, label: "Billing" },
    ],
  },
  {
    id: "team",
    items: [
      { icon: UsersIcon, label: "Manage team" },
      { icon: SquarePenIcon, label: "Customization" },
      { icon: CirclePlusIcon, label: "Add team account" },
    ],
  },
  {
    id: "session",
    items: [{ icon: LogOutIcon, label: "Logout", variant: "destructive" }],
  },
]

const ProfileDropdown = ({
  trigger,
  defaultOpen,
  align = "end",
}: Props) => {
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent className="w-80" align={align}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-4 px-4 py-2.5 font-normal">
            <div className="relative">
              <Avatar size="lg">
                <AvatarImage
                  src="https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png"
                  alt="John Doe"
                />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <span className="absolute right-0 bottom-0 block size-2 rounded-full bg-green-600 ring-2 ring-card" />
            </div>
            <div className="flex flex-1 flex-col items-start">
              <span className="text-lg font-semibold text-foreground">
                John Doe
              </span>
              <span className="text-base text-muted-foreground">
                john.doe@example.com
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {profileMenuSections.map((section) => (
          <Fragment key={section.id}>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {section.items.map(({ icon: Icon, label, variant }) => (
                <DropdownMenuItem
                  key={label}
                  variant={variant}
                  className="gap-2 px-4 py-2.5 text-base"
                >
                  <Icon
                    className={
                      variant === "destructive"
                        ? "size-5"
                        : "size-5 text-foreground"
                    }
                  />
                  <span>{label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProfileDropdown
