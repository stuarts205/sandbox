import { Daytona } from "@daytona/sdk"

if (!process.env.DAYTONA_API_KEY) {
  throw new Error("DAYTONA_API_KEY is not set")
}

// No server-only guard, for the same reason as lib/db/client: the Trigger.dev
// chat agent imports this directly.
export const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY })
