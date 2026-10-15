import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic"
import { auth } from "@clerk/nextjs/server"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from "ai"

import { anthropic, generateMessageId } from "@/lib/ai"
import { getGame, saveGameMessages } from "@/lib/games/queries"

// Building a game means a long think and a long reply; 30s cut it off.
export const maxDuration = 300

export async function POST(req: Request) {
  const { isAuthenticated, orgId } = await auth()
  if (!isAuthenticated || !orgId) {
    return new Response("Unauthorized", { status: 401 })
  }

  // The client sends only its newest message; the stored thread is the source
  // of truth for everything before it. With no message, the client is asking
  // for a reply to the stored thread as-is (e.g. a new game's opening prompt).
  const { id, message }: { id: string; message?: unknown } = await req.json()

  const game = await getGame(id)
  if (!game) {
    return new Response("Not found", { status: 404 })
  }

  const messages = await validateUIMessages({
    messages: message ? [...game.messages, message] : game.messages,
  })
  if (messages.at(-1)?.role !== "user") {
    return new Response("Nothing to reply to", { status: 400 })
  }

  const result = streamText({
    model: anthropic("claude-sonnet-5-5"),
    messages: await convertToModelMessages(messages),
    providerOptions: {
      anthropic: {
        // Sonnet 5.5 always thinks first, and by default returns that thinking
        // empty, so the reply looks stalled. Summaries give the UI progress.
        thinking: { type: "adaptive", display: "summarized" },
        // The API default is high, which thinks for minutes before replying.
        effort: "medium",
      } satisfies AnthropicLanguageModelOptions,
    },
  })

  // Run to completion even if the client disconnects, so onEnd still saves.
  result.consumeStream()

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId,
      onEnd: ({ messages }) => saveGameMessages(game.id, orgId, messages),
    }),
  })
}
