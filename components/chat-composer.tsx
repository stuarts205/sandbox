"use client"

import {
  ArrowUpIcon,
  ChevronDownIcon,
  GripHorizontalIcon,
  SquareIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"

const models = ["Kimi K3", "Claude Opus 5", "GPT-5", "Gemini 3 Pro"]

type ChatComposerProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => void
  // When given, the button turns into a stop button while pending.
  onStop?: () => void
  pending?: boolean
  placeholder?: string
}

export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  pending = false,
  placeholder = "Describe the game you want to build...",
}: ChatComposerProps) {
  const canSubmit = value.trim().length > 0 && !pending
  const canStop = pending && onStop !== undefined

  function submit() {
    if (!canSubmit) return
    onSubmit(value)
  }

  return (
    <InputGroup className="bg-popover">
      <InputGroupTextarea
        placeholder={placeholder}
        rows={1}
        className="field-sizing-content max-h-48 min-h-10"
        value={value}
        disabled={pending}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <InputGroupAddon align="block-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<InputGroupButton variant="ghost" size="sm" />}
          >
            <GripHorizontalIcon />
            Kimi K3
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto">
            {models.map((model) => (
              <DropdownMenuItem key={model}>{model}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <InputGroupButton
          variant="default"
          size="icon-sm"
          className="ml-auto rounded-full"
          aria-label={canStop ? "Stop" : "Send"}
          disabled={!canSubmit && !canStop}
          onClick={canStop ? onStop : submit}
        >
          {canStop ? <SquareIcon className="fill-current" /> : <ArrowUpIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
