"use client"

import { useState } from "react"
import type { ReactElement } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

type Props = {
  trigger: ReactElement
  defaultOpen?: boolean
  align?: "start" | "center" | "end"
}

const languages = [
  { value: "english", label: "English" },
  { value: "german", label: "Deutsch" },
  { value: "spanish", label: "Española" },
  { value: "portuguese", label: "Português" },
  { value: "korean", label: "한국인" },
]

const LanguageDropdown = ({ defaultOpen, align = "end", trigger }: Props) => {
  const [language, setLanguage] = useState("english")

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent className="w-50" align={align}>
        <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
          {languages.map(({ value, label }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageDropdown
