"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import { generateText, type UIMessage } from "ai"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { anthropic, generateMessageId } from "@/lib/ai"
import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"
import { isGameModelId, type GameModelId } from "@/lib/games/model-catalog"
import { errorAttributes } from "@/lib/log"

export async function createGame(prompt: string, modelId: GameModelId) {
  const { orgId } = await auth.protect()
  if (!orgId) {
    throw new Error("No active organization")
  }

  const trimmed = prompt.trim()
  if (!trimmed) {
    throw new Error("Prompt is required")
  }

  if (!isGameModelId(modelId)) {
    throw new Error("Unknown model")
  }

  const title = await generateTitle(trimmed)

  // The prompt opens the thread; ChatThread requests the reply on arrival.
  const firstMessage: UIMessage = {
    id: generateMessageId(),
    role: "user",
    parts: [{ type: "text", text: trimmed }],
  }

  const [game] = await db
    .insert(games)
    .values({ orgId, title, messages: [firstMessage] })
    .returning({ id: games.id })

  Sentry.logger.info("Game created", { "game.id": game.id, "org.id": orgId })

  // The (app) layout renders the sidebar's games list.
  revalidatePath("/(app)", "layout")

  // The model isn't stored with the game: the URL hands the home page's pick
  // to the chat, which runs the opening turn on it.
  redirect(`/games/${game.id}?model=${modelId}`)
}

async function generateTitle(prompt: string) {
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-5-5"),
      instructions:
        "Write a short title (at most 6 words) for a game based on the user's prompt. Reply with the title only: no quotes or trailing punctuation.",
      prompt,
      maxOutputTokens: 32,
    })
    const title = text.trim()
    if (title) return title
  } catch (error) {
    Sentry.logger.warn(
      "Game title generation failed; using the prompt",
      errorAttributes(error)
    )
  }

  // A title is nice-to-have; don't block game creation on it.
  return prompt
}
