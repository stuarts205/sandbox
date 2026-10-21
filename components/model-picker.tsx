"use client"

import { ChevronDownIcon, GripHorizontalIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroupButton } from "@/components/ui/input-group"
import { gameModels, type GameModelId } from "@/lib/games/model-catalog"

type ModelPickerProps = {
  modelId: GameModelId
  onModelChange: (modelId: GameModelId) => void
}

// Shows the selection and reports changes; the caller owns it.
export function ModelPicker({ modelId, onModelChange }: ModelPickerProps) {
  const selected = gameModels.find((model) => model.id === modelId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<InputGroupButton variant="ghost" size="sm" />}
      >
        <GripHorizontalIcon />
        {selected?.name}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuRadioGroup
          value={modelId}
          onValueChange={(value: GameModelId) => onModelChange(value)}
        >
          {gameModels.map((model) => (
            <DropdownMenuRadioItem key={model.id} value={model.id} closeOnClick>
              <div className="flex flex-col gap-0.5">
                <span>{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  {model.tagline}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
