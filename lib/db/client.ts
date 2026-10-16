import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "./schema"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set")
}

// Pooled connection string for app queries; drizzle-kit uses the unpooled one.
// No server-only guard here: the Trigger.dev chat agent imports this directly,
// and server-only throws outside Next's react-server build. App code imports
// from "@/lib/db", which keeps the guard.
const sql = neon(process.env.DATABASE_URL)

export const db = drizzle({ client: sql, schema })
