import type {
  LoadContextEvent,
  TranscriptLoadOptions,
  TranscriptScope,
  TranscriptStorage,
} from "@trigger.dev/sdk/ai"
import type { UIMessage } from "ai"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { games } from "@/lib/db/schema"

// Keeps a game's chat transcript on its games row, as one document. Runs inside
// the Trigger.dev chat agent, which has no request or Clerk session, so it goes
// by game id alone: the server actions check the active org owns the game
// before handing out a token for its chat.
export const gameTranscriptStorage: TranscriptStorage = {
  async load<TUIMessage extends UIMessage>(
    { chatId }: TranscriptScope,
    opts?: TranscriptLoadOptions
  ) {
    const [game] = await db
      .select({
        messages: games.messages,
        state: games.chatState,
        nonFinalIds: games.chatNonFinalIds,
        lastOutEventId: games.chatLastEventId,
        lastInEventId: games.chatLastInEventId,
      })
      .from(games)
      .where(eq(games.id, chatId))
      .limit(1)
    if (!game) {
      return { messages: [], state: null }
    }

    let messages = game.messages
    let nextCursor: string | undefined
    if (opts?.before) {
      const index = messages.findIndex((m) => m.id === opts.before)
      messages = index === -1 ? [] : messages.slice(0, index)
    }
    if (opts?.limit && messages.length > opts.limit) {
      messages = messages.slice(-opts.limit)
      nextCursor = messages[0].id
    }

    return {
      messages: messages as TUIMessage[],
      state: game.state ?? null,
      cursors: {
        lastOutEventId: game.lastOutEventId ?? undefined,
        lastInEventId: game.lastInEventId ?? undefined,
      },
      nextCursor,
      nonFinalIds: game.nonFinalIds,
    }
  },

  // The changeset carries the whole transcript as it now stands; a document
  // store writes it as-is. One statement, so a reload never sees a reply
  // without its cursor (or the reverse), which would replay the turn on top
  // of the saved reply. A cursor the runtime leaves out keeps its old value.
  async save({ chatId }, { transcript, cursors }) {
    await db
      .update(games)
      .set({
        messages: transcript.entries.map((entry) => entry.message),
        chatState: transcript.state ?? null,
        chatNonFinalIds: transcript.entries
          .filter((entry) => !entry.final)
          .map((entry) => entry.id),
        chatLastEventId: cursors?.lastOutEventId,
        chatLastInEventId: cursors?.lastInEventId,
      })
      .where(eq(games.id, chatId))
  },

  // The stored thread decides what the model sees. A new game's opening prompt
  // is stored by createGame before the chat has a session, and the runtime
  // only calls load when continuing a chat, so a first run starts with
  // nothing: read the thread from the row then. After that, the runtime's own
  // transcript is the stored thread (save keeps the row in step with it).
  async loadContext<TUIMessage extends UIMessage>(
    { chatId }: TranscriptScope,
    {
      trigger,
      incomingMessages,
      previousMessages,
    }: LoadContextEvent<unknown, TUIMessage>
  ) {
    let messages: UIMessage[] = previousMessages
    if (messages.length === 0) {
      const [game] = await db
        .select({ messages: games.messages })
        .from(games)
        .where(eq(games.id, chatId))
        .limit(1)
      messages = game?.messages ?? []
    }

    // The client sends only its newest message (none for a regenerate). An
    // answer to ask_player comes back as the asking message, cut down to the
    // answered tool part; the runtime merges that answer into the stored copy,
    // so keep the stored one rather than replacing it.
    messages = [...messages]
    for (const incoming of incomingMessages) {
      if (!messages.some((m) => m.id === incoming.id)) {
        messages.push(incoming)
      }
    }

    // A regenerate replies to the last user message, dropping any answer after it.
    if (trigger === "regenerate-message") {
      while (messages.at(-1)?.role === "assistant") messages.pop()
    }

    return messages as TUIMessage[]
  },
}
