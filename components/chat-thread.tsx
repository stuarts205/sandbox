"use client"

import { useChat } from "@ai-sdk/react"
import {
  useTriggerChatTransport,
  type UseTriggerChatTransportOptions,
} from "@trigger.dev/sdk/chat/react"
import {
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ReasoningUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai"
import { CheckIcon, XIcon } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { mintChatAccessToken, startChatSession } from "@/lib/games/chat-actions"
import type { gameChat } from "@/trigger/chat"

function getText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

function ThinkingLine({ done }: { done?: boolean }) {
  return (
    <TraceLine status={done ? undefined : "running"}>
      <TraceTitle>{done ? "Thought" : "Thinking"}</TraceTitle>
    </TraceLine>
  )
}

// The model thinks before it replies; its summary can be expanded once shown.
function Reasoning({ part }: { part: ReasoningUIPart }) {
  const done = part.state !== "streaming"

  if (!part.text) {
    return (
      <Trace>
        <ThinkingLine done={done} />
      </Trace>
    )
  }

  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <ThinkingLine done={done} />
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="whitespace-pre-wrap">
          {part.text}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}

type ToolPart = ToolUIPart | DynamicToolUIPart
type ToolStatus = "active" | "done" | "failed"

// Labels for the game's file tools, by status; other tools show their name.
const toolLabels: Record<string, Record<ToolStatus, string>> = {
  list_files: { active: "Listing", done: "Listed", failed: "Couldn't list" },
  read_file: { active: "Reading", done: "Read", failed: "Couldn't read" },
  write_file: { active: "Writing", done: "Wrote", failed: "Couldn't write" },
  replace_text: { active: "Editing", done: "Edited", failed: "Couldn't edit" },
  delete_file: {
    active: "Deleting",
    done: "Deleted",
    failed: "Couldn't delete",
  },
}

function getToolStatus(part: ToolPart): ToolStatus {
  switch (part.state) {
    case "output-available":
      return "done"
    case "output-error":
    case "output-denied":
      return "failed"
    default:
      return "active"
  }
}

// The file tools all take a path; it streams in with the input, so it may not
// be there yet.
function getToolPath(part: ToolPart) {
  const input = part.input as { path?: unknown } | undefined
  return typeof input?.path === "string" ? input.path : undefined
}

function ToolCall({ part }: { part: ToolPart }) {
  const status = getToolStatus(part)
  const name = getToolName(part)
  const label = toolLabels[name]?.[status] ?? name
  const path = getToolPath(part) ?? (name === "list_files" ? "files" : "")

  return (
    <Marker
      data-status={status}
      title={part.state === "output-error" ? part.errorText : undefined}
      className="data-[status=failed]:text-destructive"
    >
      <MarkerIcon>
        {status === "active" ? (
          <Spinner />
        ) : status === "done" ? (
          <CheckIcon />
        ) : (
          <XIcon />
        )}
      </MarkerIcon>
      <MarkerContent>
        {label}
        {path && (
          <>
            {" "}
            <code className="font-mono text-xs">{path}</code>
          </>
        )}
      </MarkerContent>
    </Marker>
  )
}

type ChatSession = NonNullable<
  UseTriggerChatTransportOptions["sessions"]
>[string]

function AssistantAvatar() {
  return (
    <MessageAvatar className="size-8 self-start rounded-lg bg-transparent">
      <Image src="/logo.svg" alt="" width={32} height={32} />
    </MessageAvatar>
  )
}

export function ChatThread({
  id,
  initialMessages,
  initialSession,
  onTurnComplete,
}: {
  id: string
  initialMessages: UIMessage[]
  // The chat's session, once it has one; lets a reload reconnect to it.
  initialSession?: ChatSession
  // Fires when the agent finishes a turn, stopped and failed ones included,
  // since either may have written files first.
  onTurnComplete?: () => void
}) {
  const [input, setInput] = useState("")
  // The agent loads the stored thread, so only the new message is sent. A
  // regenerate sends none: the agent replies to the stored thread as-is.
  const transport = useTriggerChatTransport<typeof gameChat>({
    task: "game-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId }) => startChatSession({ chatId }),
    sessions: initialSession ? { [id]: initialSession } : undefined,
  })
  const { messages, sendMessage, regenerate, resumeStream, stop, status } =
    useChat({
      id,
      messages: initialMessages,
      transport,
      // A dropped connection ends the stream but not the turn, which keeps
      // running on the agent; it finishes once the stream is resumed.
      onFinish: ({ isDisconnect }) => {
        if (!isDisconnect) onTurnComplete?.()
      },
    })

  // A new game arrives with its prompt stored but unanswered; reply to it once.
  // Once the chat has a session, that reply (or a later one) may still be
  // streaming from before a reload; reconnect to it instead.
  // useChat stops the chat on unmount, so a request sent from Strict Mode's
  // throwaway mount would be aborted, and an aborted reconnect makes the
  // transport skip the next one until it winds down. Deferring it lets that
  // cleanup cancel the timer before anything is sent; the ref then keeps it to
  // one request. (useChat's own `resume` option has no such guard.)
  const requestedId = useRef<string | null>(null)
  useEffect(() => {
    if (requestedId.current === id) return
    if (!initialSession && initialMessages.at(-1)?.role !== "user") return

    const timer = setTimeout(() => {
      requestedId.current = id
      if (initialSession) {
        resumeStream()
      } else {
        regenerate()
      }
    })
    return () => clearTimeout(timer)
  }, [id, initialMessages, initialSession, regenerate, resumeStream])

  function submit(value: string) {
    sendMessage({ text: value })
    setInput("")
  }

  // useChat's stop() only ends the local stream, and after a resume it doesn't
  // reach the agent at all; stopGeneration tells the agent to abort the turn.
  // The run stays alive for the next message.
  function cancel() {
    stop()
    void transport.stopGeneration(id)
  }

  return (
    <div className="flex size-full min-h-0 flex-col">
      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">
              {messages.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  {message.role === "assistant" ? (
                    <Message>
                      <AssistantAvatar />
                      <MessageContent>
                        {message.parts.length === 0 && (
                          <Trace>
                            <ThinkingLine />
                          </Trace>
                        )}
                        {message.parts.map((part, index) =>
                          part.type === "reasoning" ? (
                            <Reasoning key={index} part={part} />
                          ) : isToolUIPart(part) ? (
                            <ToolCall key={part.toolCallId} part={part} />
                          ) : part.type === "text" && part.text ? (
                            <Bubble key={index} variant="ghost">
                              <BubbleContent>{part.text}</BubbleContent>
                            </Bubble>
                          ) : null
                        )}
                      </MessageContent>
                    </Message>
                  ) : (
                    <Message align="end">
                      <MessageContent>
                        <Bubble variant="secondary">
                          <BubbleContent>{getText(message)}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
              ))}
              {status === "submitted" && (
                <Message>
                  <AssistantAvatar />
                  <MessageContent>
                    <Trace>
                      <ThinkingLine />
                    </Trace>
                  </MessageContent>
                </Message>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <ChatComposer
          value={input}
          onValueChange={setInput}
          onSubmit={submit}
          onStop={cancel}
          pending={status === "submitted" || status === "streaming"}
          placeholder="Ask for a change..."
        />
      </div>
    </div>
  )
}
