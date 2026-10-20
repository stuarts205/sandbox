import { readdir } from "node:fs/promises"
import path from "node:path"

import { DaytonaNotFoundError } from "@daytona/sdk"
import { eq } from "drizzle-orm"

import { daytona } from "@/lib/daytona/client"
import { db } from "@/lib/db/client"
import { games } from "@/lib/db/schema"

export const GAME_DIR = "/home/daytona/game"
export const GAME_PORT = 8080

// The files every new game starts from. Nothing imports them, so the path
// resolves from the working directory: the project root under next and trigger
// dev, and the build output in a Trigger.dev deploy, which trigger.config.ts
// copies the folder into.
const RUNTIME_DIR = path.join(process.cwd(), "lib/games/runtime")

// Gives a game its sandbox: a fresh one seeded with the runtime files in the
// game directory, its id saved on the game. The gameId label ties a sandbox
// back to its game in the Daytona dashboard.
export async function createGameSandbox(gameId: string) {
  const sandbox = await daytona.create({ labels: { gameId } })

  await seedGameDir(sandbox)

  await db
    .update(games)
    .set({ sandboxId: sandbox.id })
    .where(eq(games.id, gameId))

  return { sandbox }
}

// Hands a chat tool the game's sandbox, started and ready for commands. A
// sandbox that's gone from Daytona is replaced with a fresh one; one that
// auto-stopped, archived or hit a recoverable error is brought back up. An
// unrecoverable error throws rather than replacing the sandbox, since its
// files may still be salvageable.
export async function getGameSandbox(gameId: string) {
  const [game] = await db
    .select({ sandboxId: games.sandboxId })
    .from(games)
    .where(eq(games.id, gameId))
  if (!game) {
    throw new Error(`Game ${gameId} not found`)
  }
  if (!game.sandboxId) {
    return createGameSandbox(gameId)
  }

  let sandbox: Sandbox
  try {
    sandbox = await daytona.get(game.sandboxId)
  } catch (error) {
    if (error instanceof DaytonaNotFoundError) {
      return createGameSandbox(gameId)
    }
    throw error
  }

  switch (sandbox.state) {
    case "started":
      break
    case "destroyed":
    case "destroying":
      return createGameSandbox(gameId)
    case "creating":
    case "starting":
    case "restoring":
    case "resuming":
      await sandbox.waitUntilStarted()
      break
    case "stopping":
      await sandbox.waitUntilStopped()
      await sandbox.start()
      break
    case "error":
      if (!sandbox.recoverable) {
        throw new Error(
          `Sandbox ${sandbox.id} for game ${gameId} failed: ${sandbox.errorReason}`
        )
      }
      await sandbox.recover()
      break
    default:
      await sandbox.start()
  }

  return { sandbox }
}

// Serves the game directory over HTTP on GAME_PORT and returns the running
// sandbox. A sandbox auto-stops when idle, which kills the server, so this
// starts the sandbox if needed and only launches a server when the health
// check fails.
export async function startGameServer(sandboxId: string) {
  const sandbox = await daytona.get(sandboxId)
  if (sandbox.state !== "started") {
    await sandbox.start()
  }

  if (!(await isGameServerUp(sandbox))) {
    await sandbox.process.executeCommand(
      `sh -c "nohup python3 -m http.server ${GAME_PORT} --directory ${GAME_DIR} > /tmp/game-server.log 2>&1 &"`
    )
    await waitForGameServer(sandbox)
  }

  return { sandbox }
}

type Sandbox = Awaited<ReturnType<typeof daytona.get>>

// Mirrors RUNTIME_DIR into GAME_DIR. Folders are created first, sorted so each
// parent exists before its children, then every file is streamed up from disk
// in one batch.
async function seedGameDir(sandbox: Sandbox) {
  const entries = await readdir(RUNTIME_DIR, {
    recursive: true,
    withFileTypes: true,
  })
  const toGamePath = (entry: (typeof entries)[number]) => {
    const localPath = path.join(entry.parentPath, entry.name)
    const relativePath = path.relative(RUNTIME_DIR, localPath)
    return {
      localPath,
      gamePath: path.posix.join(GAME_DIR, ...relativePath.split(path.sep)),
    }
  }

  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => toGamePath(entry).gamePath)
    .sort()
  for (const folder of [GAME_DIR, ...folders]) {
    await sandbox.fs.createFolder(folder, "755")
  }

  await sandbox.fs.uploadFiles(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const { localPath, gamePath } = toGamePath(entry)
        return { source: localPath, destination: gamePath }
      })
  )
}

async function isGameServerUp(sandbox: Sandbox) {
  const { exitCode } = await sandbox.process.executeCommand(
    `curl -sf -o /dev/null http://localhost:${GAME_PORT}/`
  )
  return exitCode === 0
}

async function waitForGameServer(sandbox: Sandbox, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    if (await isGameServerUp(sandbox)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Game server in sandbox ${sandbox.id} did not start`)
}
