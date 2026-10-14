"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

export async function createGame(prompt: string) {
  const { orgId } = await auth.protect()
  if (!orgId) {
    throw new Error("No active organization")
  }

  const title = prompt.trim()
  if (!title) {
    throw new Error("Prompt is required")
  }

  const [game] = await db
    .insert(games)
    .values({ orgId, title })
    .returning({ id: games.id })

  // The (app) layout renders the sidebar's games list.
  revalidatePath("/(app)", "layout")

  return game
}
