import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"
import { eq } from "drizzle-orm"

import { anthropic, generateMessageId } from "@/lib/ai"
import { createGameSandbox } from "@/lib/daytona/utils"
import { db } from "@/lib/db/client"
import { games } from "@/lib/db/schema"
import { gameInstructions } from "@/lib/games/instructions"
import { createGameTools } from "@/lib/games/tools"
import { gameTranscriptStorage } from "@/lib/games/transcript-storage"

// The chat id is the game id. The agent runs with no request or Clerk session,
// so it reads and writes the game by id alone: the server actions check the
// active org owns the game before handing out a token for its chat.
export const gameChat = chat.agent({
  id: "game-chat",
  // Replies get the same msg_ ids createGame gives the opening prompt.
  uiMessageStreamOptions: { generateMessageId },

  // The run's streamText carries this, so run() doesn't pass it. It's the same
  // every turn, so it's cached.
  system: gameInstructions.join("\n\n"),
  cacheControl: { type: "ephemeral" },

  // The games row holds the thread: the runtime saves every change to it,
  // and the stored thread decides what the model sees.
  storage: gameTranscriptStorage,

  // File tools confined to this game's sandbox directory, built per turn from
  // the chat id. Declared here so the runtime re-converts past tool calls with
  // them, and handed back to run() typed.
  tools: ({ chatId }) => createGameTools(chatId),

  // Fires once, on the game's first message.
  onChatStart: async ({ chatId }) => {
    await createGameSandbox(chatId)
  },

  // Lets a reload mid-reply reconnect: the page hands this token to the
  // transport, which resumes the in-flight turn.
  onTurnStart: async ({ chatId, chatAccessToken }) => {
    chat.deferBeforeOutput(
      db.update(games).set({ chatAccessToken }).where(eq(games.id, chatId))
    )
  },

  run: async ({ messages, tools, signal, streamText }) =>
    streamText({
      model: anthropic("claude-sonnet-5-5"),
      messages,
      tools,
      // streamText stops after one step by default, which would end the turn
      // at the first tool call. Building a game takes many reads and writes.
      stopWhen: stepCountIs(50),
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
