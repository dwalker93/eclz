import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Progress } from "@workspace/ui/components/progress"
import {
  EllipsisVerticalIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "lucide-react"

const listItems = ["Share", "Update", "Refresh"]

export type EarningItem = {
  img: string
  platform: string
  technologies: string
  earnings: string
  progressPercentage: number
}

type Props = {
  title: string
  earning: number
  trend: "up" | "down"
  percentage: number
  comparisonText: string
  earningData: EarningItem[]
  className?: string
}

const TotalEarningCard = ({
  earningData,
  title,
  earning,
  trend,
  percentage,
  comparisonText,
  className,
}: Props) => {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-6">
        <span className="flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded-full text-muted-foreground"
                />
              }
            >
              <EllipsisVerticalIcon />
              <span className="sr-only">Menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {listItems.map((item) => (
                  <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold">${earning}</span>
            <span className="flex items-center gap-1">
              {trend === "up" ? (
                <ChevronUpIcon className="size-4" />
              ) : (
                <ChevronDownIcon className="size-4" />
              )}
              <span className="text-sm">{percentage}%</span>
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            {comparisonText}
          </span>
        </div>
      </CardContent>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-1 flex-col justify-evenly gap-4">
          {earningData.map((item) => (
            <div
              key={item.platform}
              className="flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2.5">
                <Avatar className="size-11 rounded-sm after:rounded-[inherit] after:border-0">
                  <AvatarFallback className="shrink-0 rounded-sm bg-primary/10">
                    <img
                      src={item.img}
                      alt={item.platform}
                      className="size-6"
                    />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <span className="text-base font-medium">
                    {item.platform}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.technologies}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm">{item.earnings}</p>
                <Progress
                  value={item.progressPercentage}
                  className="w-36 **:data-[slot=progress-track]:h-1.5"
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default TotalEarningCard
