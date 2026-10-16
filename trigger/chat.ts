import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"
import { eq } from "drizzle-orm"

import { anthropic, generateMessageId } from "@/lib/ai"
import { db } from "@/lib/db/client"
import { games } from "@/lib/db/schema"
import { gameTranscriptStorage } from "@/lib/games/transcript-storage"

// The chat id is the game id. The agent runs with no request or Clerk session,
// so it reads and writes the game by id alone: the server actions check the
// active org owns the game before handing out a token for its chat.
export const gameChat = chat.agent({
  id: "game-chat",
  // Replies get the same msg_ ids createGame gives the opening prompt.
  uiMessageStreamOptions: { generateMessageId },

  // The games row holds the thread: the runtime saves every change to it,
  // and the stored thread decides what the model sees.
  storage: gameTranscriptStorage,

  // Lets a reload mid-reply reconnect: the page hands this token to the
  // transport, which resumes the in-flight turn.
  onTurnStart: async ({ chatId, chatAccessToken }) => {
    chat.deferBeforeOutput(
      db.update(games).set({ chatAccessToken }).where(eq(games.id, chatId))
    )
  },

  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: anthropic("claude-sonnet-5-5"),
      messages,
      abortSignal: signal,
      providerOptions: {
        anthropic: {
          // Sonnet 5.5 always thinks first, and by default returns that thinking
          // empty, so the reply looks stalled. Summaries give the UI progress.
          thinking: { type: "adaptive", display: "summarized" },
          // The API default is high, which thinks for minutes before replying.
          effort: "medium",
        } satisfies AnthropicLanguageModelOptions,
      },
    }),
})
