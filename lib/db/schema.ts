import type { UIMessage } from "ai"
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    title: text("title").notNull(),
    // The game's chat thread, stored whole in useChat's UIMessage format.
    messages: jsonb("messages").$type<UIMessage[]>().notNull().default([]),
    // The chat's Trigger.dev session token, so a reload reconnects to it.
    chatAccessToken: text("chat_access_token"),
    // The rest of the chat agent's transcript, saved with messages in one
    // statement so they never disagree: the stream cursors the next run (and
    // a reload) resume from, the runtime's opaque state record, and the ids of
    // partial answers from a stopped or failed turn.
    chatLastEventId: text("chat_last_event_id"),
    chatLastInEventId: text("chat_last_in_event_id"),
    chatState: jsonb("chat_state").$type<unknown>(),
    chatNonFinalIds: jsonb("chat_non_final_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    // The game's Daytona sandbox, created when its chat starts.
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Every query is scoped to the active Clerk org; createdAt supports ordered listing.
  (t) => [index("games_org_id_created_at_idx").on(t.orgId, t.createdAt)]
)
