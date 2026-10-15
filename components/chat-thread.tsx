"use client"

import Image from "next/image"

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

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

const messages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content:
      "Make a top-down racing game where you drift around a neon city at night.",
  },
  {
    id: "2",
    role: "assistant",
    content:
      "On it! I'll set up a top-down camera, a car with drift physics, and a looping track through a neon-lit city grid. Want a time trial or races against AI opponents?",
  },
  {
    id: "3",
    role: "user",
    content: "Races against AI. Three opponents, and give them different colors.",
  },
  {
    id: "4",
    role: "assistant",
    content:
      "Done. There are now three AI racers in pink, cyan and lime, each following the racing line with slightly different aggression. The first to finish three laps wins.",
  },
  {
    id: "5",
    role: "user",
    content: "Can drifting fill up a boost meter?",
  },
  {
    id: "6",
    role: "assistant",
    content:
      "Yes. Holding a drift now charges a boost meter in the bottom-left corner. Press Space to spend it for a short burst of speed, with a trail of sparks behind the car.",
  },
  {
    id: "7",
    role: "user",
    content: "Love it. Add some rain and puddles that make the car slide.",
  },
  {
    id: "8",
    role: "assistant",
    content:
      "Added a rain shader with reflections on the road, plus puddles scattered around the corners. Driving through one cuts your grip for a moment, so you'll need to plan your drift lines around them.",
  },
]

export function ChatThread() {
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
                          <BubbleContent>{message.content}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  ) : (
                    <Message align="end">
                      <MessageContent>
                        <Bubble variant="secondary">
                          <BubbleContent>{message.content}</BubbleContent>
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
        <ChatComposer />
      </div>
    </div>
  )
}
