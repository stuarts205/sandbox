"use client"

import { useState, useTransition } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { createGame } from "@/lib/games/actions"
import { defaultGameModelId, type GameModelId } from "@/lib/games/model-catalog"

export function NewGameComposer() {
  const [prompt, setPrompt] = useState("")
  const [modelId, setModelId] = useState<GameModelId>(defaultGameModelId)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(value: string) {
    // createGame redirects to the new game, so the composer stays pending
    // until the navigation lands.
    startTransition(() => createGame(value, modelId))
  }

  return (
    <ChatComposer
      value={prompt}
      onValueChange={setPrompt}
      onSubmit={handleSubmit}
      pending={isPending}
      modelId={modelId}
      onModelChange={setModelId}
    />
  )
}
