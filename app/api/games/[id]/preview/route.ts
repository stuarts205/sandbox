import type { NextRequest } from "next/server"

import { GAME_PORT, startGameServer } from "@/lib/daytona/utils"
import { getGame } from "@/lib/games/queries"

const PREVIEW_TTL_SECONDS = 60 * 60

// Hands the browser a signed preview URL for the game's sandbox, so the
// Daytona API key and sandbox-wide preview token never leave the server.
// getGame scopes the lookup to the active org.
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/games/[id]/preview">
) {
  const { id } = await ctx.params
  const game = await getGame(id)
  if (!game?.sandboxId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { sandbox } = await startGameServer(game.sandboxId)
  const { url } = await sandbox.getSignedPreviewUrl(
    GAME_PORT,
    PREVIEW_TTL_SECONDS
  )
  return Response.json({ url })
}
