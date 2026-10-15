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
