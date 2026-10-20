"use client"

import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { useState, type ComponentProps } from "react"

import { ChatPreview } from "@/components/chat-preview"
import { ChatThread } from "@/components/chat-thread"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

type GameChatProps = ComponentProps<typeof ChatThread>

// Panels wrap their children in an `overflow: auto` div, which would make each
// panel a second scroll container. The chat's message scroller is the only
// thing that should scroll, so the panels clip instead.
const panelStyle = { overflow: "clip" } as const

// The file tools that change the game.
const fileChangeTools = new Set(["write_file", "replace_text", "delete_file"])

// Whether the agent has built anything yet. A new game opens with an interview,
// so its sandbox exists well before there is a game in it to preview.
function hasGame(messages: UIMessage[]) {
  return messages.some((message) =>
    message.parts.some(
      (part) =>
        isToolUIPart(part) &&
        fileChangeTools.has(getToolName(part)) &&
        part.state === "output-available"
    )
  )
}

// The chat takes the full width until a turn ends having built the game; the
// preview then opens on the right and stays. The chat is always the group's
// first panel, so adding the preview never remounts it: a remount would restart
// its stream and could send the opening prompt again.
export function GameChat(props: GameChatProps) {
  const [showPreview, setShowPreview] = useState(() =>
    hasGame(props.initialMessages)
  )
  // Bumped after every turn so the preview reloads to show the agent's edits.
  const [revision, setRevision] = useState(0)

  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel id="chat" style={panelStyle}>
        <ChatThread
          {...props}
          onTurnComplete={(messages) => {
            setRevision((current) => current + 1)
            if (hasGame(messages)) setShowPreview(true)
          }}
        />
      </ResizablePanel>
      {showPreview && (
        <>
          <ResizableHandle />
          <ResizablePanel id="preview" style={panelStyle}>
            <ChatPreview gameId={props.id} revision={revision} />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  )
}
