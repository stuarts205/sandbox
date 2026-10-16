"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat } from "@trigger.dev/sdk/ai"

import { getGame } from "@/lib/games/queries"
import type { gameChat } from "@/trigger/chat"

// The transport calls both actions with a chat id from the browser. It's a game
// id, and the game must belong to the active org before we hand out a token.
async function requireGameChat(chatId: string) {
  const { isAuthenticated, orgId } = await auth()
  if (!isAuthenticated || !orgId) {
    throw new Error("Unauthorized")
  }

  const game = await getGame(chatId)
  if (!game) {
    throw new Error("Not found")
  }
}

const startSession = chat.createStartSessionAction<typeof gameChat>("game-chat")

// Creates the chat's session and first run, and returns a session-scoped
// token. Idempotent per chat id. Only the id is forwarded: the rest of the
// params (trigger config, tags) come from the browser and aren't ours to set.
export async function startChatSession({ chatId }: { chatId: string }) {
  await requireGameChat(chatId)
  return startSession({ chatId })
}

// The transport calls this when the session token expires.
export async function mintChatAccessToken(chatId: string) {
  await requireGameChat(chatId)
  return triggerAuth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  })
}
