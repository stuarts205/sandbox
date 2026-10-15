"use client"

import { ArrowUpIcon, ChevronDownIcon, GripHorizontalIcon } from "lucide-react"
import { useState, useTransition } from "react"

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
import { createGame } from "@/lib/games/actions"

const models = ["Kimi K3", "Claude Opus 5", "GPT-5", "Gemini 3 Pro"]

export function ChatComposer() {
  const [prompt, setPrompt] = useState("")
  const [isPending, startTransition] = useTransition()

  const canSubmit = prompt.trim().length > 0 && !isPending

  function submit() {
    if (!canSubmit) return

    startTransition(async () => {
      await createGame(prompt)
      setPrompt("")
    })
  }

  return (
    <InputGroup className="bg-popover">
      <InputGroupTextarea
        placeholder="Describe the game you want to build..."
        rows={1}
        className="field-sizing-content max-h-48 min-h-10"
        value={prompt}
        disabled={isPending}
        onChange={(event) => setPrompt(event.target.value)}
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
          disabled={!canSubmit}
          onClick={submit}
        >
          <ArrowUpIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
