import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { GameChat } from "@/components/game-chat"
import { isGameModelId } from "@/lib/games/model-catalog"
import { getGame } from "@/lib/games/queries"

export default async function Page({
  params,
  searchParams,
}: PageProps<"/games/[id]">) {
  await auth.protect({ unauthenticatedUrl: "/sign-in" })

  const { id } = await params
  // Set by createGame from the home page's pick; anything else gets the
  // default.
  const { model } = await searchParams
  const game = await getGame(id)
  if (!game) {
    notFound()
  }

  return (
    <div className="flex h-svh">
      <GameChat
        id={game.id}
        initialMessages={game.messages}
        initialModelId={isGameModelId(model) ? model : undefined}
        initialSession={
          game.chatAccessToken
            ? {
                publicAccessToken: game.chatAccessToken,
                lastEventId: game.chatLastEventId ?? undefined,
              }
            : undefined
        }
      />
    </div>
  )
}
