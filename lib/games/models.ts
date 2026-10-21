import type { LanguageModel } from "ai"

import { anthropic } from "@/lib/ai"
import type { GameModelId } from "@/lib/games/model-catalog"

// Server-side only, but no server-only guard, for the same reason as
// lib/db/client: the Trigger.dev chat agent imports this directly.
export const gameModelInstances = {
  "claude-opus-5-5": anthropic("claude-opus-5-5"),
  "claude-sonnet-5-5": anthropic("claude-sonnet-5-5"),
  "claude-haiku-5-5": anthropic("claude-haiku-5-5"),
} satisfies Record<GameModelId, LanguageModel>
