"use server"

import { auth } from "@clerk/nextjs/server"
import { generateText, type UIMessage } from "ai"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { anthropic, generateMessageId } from "@/lib/ai"
import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

export async function createGame(prompt: string) {
  const { orgId } = await auth.protect()
  if (!orgId) {
    throw new Error("No active organization")
  }

  const trimmed = prompt.trim()
  if (!trimmed) {
    throw new Error("Prompt is required")
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

  // The (app) layout renders the sidebar's games list.
  revalidatePath("/(app)", "layout")

  redirect(`/games/${game.id}`)
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
    console.error("Failed to generate game title", error)
  }

  // A title is nice-to-have; don't block game creation on it.
  return prompt
}
