"use client"

import { useChat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  type ReasoningUIPart,
  type UIMessage,
} from "ai"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

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

function AssistantAvatar() {
  return (
    <MessageAvatar className="size-8 bg-transparent self-start rounded-lg">
      <Image src="/logo.svg" alt="" width={32} height={32} />
    </MessageAvatar>
  )
}

export function ChatThread({
  id,
  initialMessages,
}: {
  id: string
  initialMessages: UIMessage[]
}) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, regenerate, status } = useChat({
    id,
    messages: initialMessages,
    // The server loads the stored thread, so only the new message is sent. A
    // regenerate sends none: the server replies to the stored thread as-is.
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ id, messages, trigger }) => ({
        body: {
          id,
          message: trigger === "submit-message" ? messages.at(-1) : undefined,
        },
      }),
    }),
  })

  // A new game arrives with its prompt stored but unanswered; reply to it once.
  // useChat stops the chat on unmount, so a request sent from Strict Mode's
  // throwaway mount would be aborted. Deferring it lets that cleanup cancel the
  // timer before anything is sent; the ref then keeps it to one request.
  const answeredId = useRef<string | null>(null)
  useEffect(() => {
    if (answeredId.current === id) return
    if (initialMessages.at(-1)?.role !== "user") return

    const timer = setTimeout(() => {
      answeredId.current = id
      regenerate()
    })
    return () => clearTimeout(timer)
  }, [id, initialMessages, regenerate])

  function submit(value: string) {
    sendMessage({ text: value })
    setInput("")
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
          pending={status === "submitted" || status === "streaming"}
          placeholder="Ask for a change..."
        />
      </div>
    </div>
  )
}
