import { createAnthropic } from "@ai-sdk/anthropic"
import { auth } from "@clerk/nextjs/server"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai"

export const maxDuration = 30

// User-level keys (sk-ant-usr-) aren't tied to a workspace, so each request
// must name one via the anthropic-workspace-id header.
const anthropic = createAnthropic({
  headers: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID! },
})

export async function POST(req: Request) {
  const { isAuthenticated } = await auth()
  if (!isAuthenticated) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: anthropic("claude-sonnet-5-5"),
    messages: await convertToModelMessages(messages),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  })
}
