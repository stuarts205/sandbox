import * as Sentry from "@sentry/node"
import { chat } from "@trigger.dev/sdk/ai"
import { isToolUIPart } from "ai"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { generateMessageId } from "@/lib/ai"
import { createGameSandbox } from "@/lib/daytona/utils"
import { db } from "@/lib/db/client"
import { games } from "@/lib/db/schema"
import { gameAgentSettings } from "@/lib/games/agent"
import { gameInstructions } from "@/lib/games/instructions"
import { defaultGameModelId, gameModelIds } from "@/lib/games/model-catalog"
import { createGameTools } from "@/lib/games/tools"
import { gameTranscriptStorage } from "@/lib/games/transcript-storage"
import { errorAttributes } from "@/lib/log"

// The chat id is the game id. The agent runs with no request or Clerk session,
// so it reads and writes the game by id alone: the server actions check the
// active org owns the game before handing out a token for its chat.
export const gameChat = chat.agent({
  id: "game-chat",
  // The page sends the model with every message, so each turn can use a
  // different one. A page that sends none gets the default.
  clientDataSchema: z
    .object({ model: z.enum(gameModelIds).optional() })
    .optional(),
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

  // One log per turn, stopped and failed ones included. A failed turn reaches
  // the player as an error in the stream but doesn't fail the run, so this is
  // the only place Sentry hears about it.
  onTurnComplete: async ({
    chatId,
    clientData,
    ctx,
    turn,
    responseMessage,
    stopped,
    finishReason,
    error,
    usage,
  }) => {
    const toolCalls =
      responseMessage?.parts.filter((part) => isToolUIPart(part)).length ?? 0
    const attributes = {
      "game.id": chatId,
      "trigger.run.id": ctx.run.id,
      "gen_ai.request.model": clientData?.model ?? defaultGameModelId,
      "chat.turn": turn,
      "chat.stopped": stopped,
      "chat.tool_calls": toolCalls,
      ...(finishReason && { "gen_ai.response.finish_reasons": finishReason }),
      ...(usage?.inputTokens !== undefined && {
        "gen_ai.usage.input_tokens": usage.inputTokens,
      }),
      ...(usage?.outputTokens !== undefined && {
        "gen_ai.usage.output_tokens": usage.outputTokens,
      }),
    }
    if (error !== undefined) {
      Sentry.logger.error("Chat turn failed", {
        ...attributes,
        ...errorAttributes(error),
      })
    } else {
      Sentry.logger.info("Chat turn completed", attributes)
    }
  },

  // The run stops using compute here until the next message; send the turn's
  // logs before it does.
  onChatSuspend: async () => {
    await Sentry.flush(2000)
  },

  run: async ({ messages, tools, clientData, signal, streamText }) =>
    streamText({
      ...gameAgentSettings(clientData?.model ?? defaultGameModelId),
      messages,
      tools,
      abortSignal: signal,
    }),
})
