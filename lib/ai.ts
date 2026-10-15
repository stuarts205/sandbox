import { createAnthropic } from "@ai-sdk/anthropic"
import { createIdGenerator } from "ai"

// User-level keys (sk-ant-usr-) aren't tied to a workspace, so each request
// must name one via the anthropic-workspace-id header.
export const anthropic = createAnthropic({
  headers: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID! },
})

export const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 })
