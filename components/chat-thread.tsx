"use client"

import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import Image from "next/image"
import { useState } from "react"

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

function getText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

export function ChatThread() {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status } = useChat()

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
                      <MessageAvatar className="size-8 bg-transparent self-start rounded-lg">
                        <Image src="/logo.svg" alt="" width={32} height={32} />
                      </MessageAvatar>
                      <MessageContent>
                        <Bubble variant="ghost">
                          <BubbleContent>{getText(message)}</BubbleContent>
                        </Bubble>
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
