"use client"

import { useEffect, useState } from "react"

import { Spinner } from "@/components/ui/spinner"

type Preview =
  { status: "loading" } | { status: "ready"; url: string } | { status: "error" }

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
          console.error(error)
          setPreview({ status: "error" })
        }
      })

    return () => controller.abort()
  }, [gameId])

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
      src={preview.url}
      title="Game preview"
      className="size-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
    />
  )
}
