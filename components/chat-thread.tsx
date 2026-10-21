"use client"

import { useChat } from "@ai-sdk/react"
import * as Sentry from "@sentry/nextjs"
import {
  useTriggerChatTransport,
  type UseTriggerChatTransportOptions,
} from "@trigger.dev/sdk/chat/react"
import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type DynamicToolUIPart,
  type ReasoningUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai"
import { CheckIcon, XIcon } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState, type FormEvent } from "react"

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
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"
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
import { defaultGameModelId, type GameModelId } from "@/lib/games/model-catalog"
import { errorAttributes } from "@/lib/log"
import type { AskPlayer } from "@/lib/games/tools"
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

// Labels for the game's tools, by status; other tools show their name.
const toolLabels: Record<string, Record<ToolStatus, string>> = {
  ask_player: { active: "Asking", done: "Answered", failed: "Couldn't ask" },
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

function isAskPlayer(part: UIMessage["parts"][number]): part is ToolPart {
  return isToolUIPart(part) && getToolName(part) === "ask_player"
}

// ask_player has no execute: the agent's turn pauses on the call until the
// player picks an option here, and the pick goes back as the tool's output.
// While the question streams in, or if the call fails, it shows as a tool line.
function AskPlayerCall({
  part,
  disabled,
  onAnswer,
}: {
  part: ToolPart
  disabled: boolean
  onAnswer: (answer: AskPlayer["output"]) => void
}) {
  if (part.state === "output-available") {
    const { question } = part.input as AskPlayer["input"]
    const { label } = part.output as AskPlayer["output"]
    return (
      <Marker>
        <MarkerIcon>
          <CheckIcon />
        </MarkerIcon>
        <MarkerContent>
          {question} <span className="text-foreground">{label}</span>
        </MarkerContent>
      </Marker>
    )
  }
  if (part.state !== "input-available") {
    return <ToolCall part={part} />
  }

  const { question, options } = part.input as AskPlayer["input"]

  // The form only submits once a choice is checked; its value is the
  // option's id.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = new FormData(event.currentTarget).get("answer")
    const option = options.find((option) => option.id === id)
    if (option) onAnswer({ id: option.id, label: option.label })
  }

  // A disabled item is also hidden, so the choices and button are disabled
  // instead.
  return (
    <Questionnaire
      shortcuts="numbers"
      onSubmit={submit}
      className="rounded-xl border p-4"
    >
      <QuestionnaireItem name="answer" required>
        <QuestionnaireTitle>{question}</QuestionnaireTitle>
        <QuestionnaireChoices>
          {options.map((option) => (
            <QuestionnaireChoice
              key={option.id}
              value={option.id}
              disabled={disabled}
            >
              {option.label}
              <QuestionnaireChoiceDescription>
                {option.description}
              </QuestionnaireChoiceDescription>
            </QuestionnaireChoice>
          ))}
        </QuestionnaireChoices>
        <QuestionnaireError />
      </QuestionnaireItem>
      <QuestionnaireActions>
        <QuestionnaireSubmit disabled={disabled}>Answer</QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
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
  initialModelId = defaultGameModelId,
  onTurnComplete,
}: {
  id: string
  initialMessages: UIMessage[]
  // The chat's session, once it has one; lets a reload reconnect to it.
  initialSession?: ChatSession
  // The model picked on the home page, which also runs the opening turn.
  initialModelId?: GameModelId
  // Fires when the agent finishes a turn, stopped and failed ones included,
  // since either may have written files first. Gets the thread as it stands.
  onTurnComplete?: (messages: UIMessage[]) => void
}) {
  const [input, setInput] = useState("")
  const [modelId, setModelId] = useState(initialModelId)
  // The agent loads the stored thread, so only the new message is sent. A
  // regenerate sends none: the agent replies to the stored thread as-is.
  // clientData goes with every message, so a model change applies from the
  // next turn on.
  const transport = useTriggerChatTransport<typeof gameChat>({
    task: "game-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId }) => startChatSession({ chatId }),
    sessions: initialSession ? { [id]: initialSession } : undefined,
    clientData: { model: modelId },
  })
  const {
    messages,
    sendMessage,
    regenerate,
    resumeStream,
    stop,
    status,
    addToolOutput,
  } = useChat({
    id,
    messages: initialMessages,
    transport,
    // Answering ask_player resolves the paused call; this sends it back so
    // the agent carries on with the answer.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // A dropped connection ends the stream but not the turn, which keeps
    // running on the agent; it finishes once the stream is resumed.
    onFinish: ({ messages, isDisconnect }) => {
      if (!isDisconnect) onTurnComplete?.(messages)
    },
    // Failures between the page and the agent: starting the session, minting
    // a token, or the stream itself. The agent's own failures are logged there.
    onError: (error) => {
      Sentry.logger.error("Chat stream failed", {
        "game.id": id,
        ...errorAttributes(error),
      })
    },
  })
  const busy = status === "submitted" || status === "streaming"

  // A question waiting on the player blocks the composer: a new message would
  // leave the question's tool call without a result, which the model rejects.
  const lastMessage = messages.at(-1)
  const awaitingAnswer =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some(
      (part) => isAskPlayer(part) && part.state === "input-available"
    )

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
                          ) : isAskPlayer(part) ? (
                            <AskPlayerCall
                              key={part.toolCallId}
                              part={part}
                              // Only the latest message's question is still
                              // open.
                              disabled={busy || message !== lastMessage}
                              onAnswer={(output) =>
                                void addToolOutput({
                                  tool: "ask_player",
                                  toolCallId: part.toolCallId,
                                  output,
                                })
                              }
                            />
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
          // Without onStop, a pending composer is just disabled.
          onStop={busy ? cancel : undefined}
          pending={busy || awaitingAnswer}
          modelId={modelId}
          onModelChange={setModelId}
          placeholder={
            awaitingAnswer
              ? "Answer the question above to continue..."
              : "Ask for a change..."
          }
        />
      </div>
    </div>
  )
}
