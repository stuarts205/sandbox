"use client"

import { useState, type ComponentProps } from "react"

import { ChatPreview } from "@/components/chat-preview"
import { ChatThread } from "@/components/chat-thread"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

type GameChatProps = ComponentProps<typeof ChatThread> & {
  sandboxId: string | null
}

// Panels wrap their children in an `overflow: auto` div, which would make each
// panel a second scroll container. The chat's message scroller is the only
// thing that should scroll, so the panels clip instead.
const panelStyle = { overflow: "clip" } as const

// Without a sandbox there is nothing to preview, so the chat takes the full
// width and no resizable layout is rendered.
export function GameChat({ sandboxId, ...props }: GameChatProps) {
  // Bumped after every turn so the preview reloads to show the agent's edits.
  const [revision, setRevision] = useState(0)

  if (!sandboxId) {
    return <ChatThread {...props} />
  }

  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel style={panelStyle}>
        <ChatThread
          {...props}
          onTurnComplete={() => setRevision((current) => current + 1)}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel style={panelStyle}>
        <ChatPreview gameId={props.id} revision={revision} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
