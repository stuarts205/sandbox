import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic"
import { stepCountIs } from "ai"

import type { GameModelId } from "@/lib/games/model-catalog"
import { gameModelInstances } from "@/lib/games/models"

// The streamText settings for a turn on the given model. The chat agent adds
// the messages, tools and abort signal.
export function gameAgentSettings(modelId: GameModelId) {
  return {
    model: gameModelInstances[modelId],
    // streamText stops after one step by default, which would end the turn
    // at the first tool call. Building a game takes many reads and writes.
    stopWhen: stepCountIs(50),
    providerOptions: {
      anthropic: {
        // All three models always think first, and by default return that
        // thinking empty, so the reply looks stalled. Summaries give the UI
        // progress.
        thinking: { type: "adaptive", display: "summarized" },
        // Sonnet defaults to high, which thinks for minutes before replying;
        // pinning it keeps the three models comparable.
        effort: "medium",
      } satisfies AnthropicLanguageModelOptions,
    },
  }
}
