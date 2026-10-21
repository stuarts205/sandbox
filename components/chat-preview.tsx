"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { errorAttributes } from "@/lib/log"

type Preview =
  { status: "loading" } | { status: "ready"; url: string } | { status: "error" }

// What the game's report.js answers a ping with: the first error it caught
// since the page loaded, or null while the game is healthy.
type GameError = {
  message: string
  source: string | null
  line: number | null
  column: number | null
  stack: string | null
}

const PING_INTERVAL_MS = 2000

export function ChatPreview({
  gameId,
  revision,
}: {
  gameId: string
  // Changes when the game's files may have changed. The preview URL stays the
  // same across edits, so setting it again wouldn't reload the frame; keying
  // the iframe on this remounts it instead.
  revision: number
}) {
  const [preview, setPreview] = useState<Preview>({ status: "loading" })
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/games/${gameId}/preview`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Preview request failed: ${res.status}`)
        }
        return res.json() as Promise<{ url: string }>
      })
      .then(({ url }) => setPreview({ status: "ready", url }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          Sentry.logger.error("Game preview URL request failed", {
            "game.id": gameId,
            ...errorAttributes(error),
          })
          setPreview({ status: "error" })
        }
      })

    return () => controller.abort()
  }, [gameId])

  // Polls the game for its health and logs the first error it reports. The
  // game keeps answering with that same error, so polling stops once it's
  // logged; a new revision remounts the frame and starts over. Pings sent
  // before the game loads, or to a game without report.js, go unanswered.
  useEffect(() => {
    const frame = frameRef.current
    if (preview.status !== "ready" || !frame) {
      return
    }
    // The preview is served from Daytona, not the app's origin.
    const origin = new URL(preview.url).origin

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== origin) {
        return
      }
      if (event.data?.type !== "game-status" || !event.data.error) {
        return
      }
      clearInterval(timer)
      window.removeEventListener("message", onMessage)

      const error: GameError = event.data.error
      Sentry.logger.error("Game reported an error", {
        "game.id": gameId,
        "game.revision": revision,
        "exception.message": error.message,
        // Log attributes take only strings, numbers and booleans.
        ...(error.stack && { "exception.stacktrace": error.stack }),
        ...(error.source && { "code.file.path": error.source }),
        ...(error.line && { "code.line.number": error.line }),
        ...(error.column && { "code.column.number": error.column }),
      })
    }

    window.addEventListener("message", onMessage)
    const timer = setInterval(() => {
      frame.contentWindow?.postMessage({ type: "game-ping" }, origin)
    }, PING_INTERVAL_MS)

    return () => {
      clearInterval(timer)
      window.removeEventListener("message", onMessage)
    }
  }, [preview, revision, gameId])

  if (preview.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (preview.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Preview unavailable
      </div>
    )
  }

  return (
    <iframe
      key={revision}
      ref={frameRef}
      src={preview.url}
      title="Game preview"
      className="size-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
    />
  )
}
