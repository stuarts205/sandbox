"use client"

import { ArrowUpIcon, SquareIcon } from "lucide-react"

import { ModelPicker } from "@/components/model-picker"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import type { GameModelId } from "@/lib/games/model-catalog"

type ChatComposerProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => void
  // When given, the button turns into a stop button while pending.
  onStop?: () => void
  pending?: boolean
  placeholder?: string
  // When both are given, the composer shows a model picker.
  modelId?: GameModelId
  onModelChange?: (modelId: GameModelId) => void
}

export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  pending = false,
  placeholder = "Describe the game you want to build...",
  modelId,
  onModelChange,
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
        {modelId && onModelChange && (
          <ModelPicker modelId={modelId} onModelChange={onModelChange} />
        )}
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
