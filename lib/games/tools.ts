import { posix } from "node:path"

import { DaytonaFileNotFoundError, type Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { z } from "zod"

import { GAME_DIR, getGameSandbox } from "@/lib/daytona/utils"

// Larger reads are cut off so one file can't flood the model's context.
const MAX_READ_BYTES = 256 * 1024
const MAX_LIST_DEPTH = 10
const MAX_LIST_ENTRIES = 500

const pathInput = z
  .string()
  .min(1)
  .describe(
    "Path relative to the game directory, such as index.html or js/game.js."
  )

// The file tools for one game, built per turn from the chat id. Every path is
// resolved against the game directory and refused if it lands outside it, so
// the model can't touch the rest of the sandbox. The sandbox is looked up on
// the first tool call and shared by the rest of the turn.
export function createGameTools(gameId: string) {
  let sandbox: Promise<Sandbox> | undefined
  const getSandbox = () => {
    sandbox ??= getGameSandbox(gameId).then(
      (result) => result.sandbox,
      (error) => {
        sandbox = undefined
        throw error
      }
    )
    return sandbox
  }

  return {
    list_files: tool({
      description:
        "List the files in the game directory, or in a folder inside it, recursively. Folders end with a slash; files show their size in bytes.",
      inputSchema: z.object({
        path: pathInput
          .default(".")
          .describe(
            "Folder to list, relative to the game directory. Defaults to the whole game."
          ),
      }),
      execute: async ({ path }) => {
        const absolute = resolveGamePath(path)
        const fs = (await getSandbox()).fs
        const entries = await fs
          .listFiles(absolute, { depth: MAX_LIST_DEPTH })
          .catch((error) => rethrow(error, path))
        if (entries.length === 0) {
          return `${toGamePath(absolute)} is empty.`
        }

        const lines = entries
          .map((entry) => {
            const relative = toGamePath(
              entry.path ?? posix.join(absolute, entry.name)
            )
            return entry.isDir ? `${relative}/` : `${relative} (${entry.size})`
          })
          .sort()
        if (lines.length > MAX_LIST_ENTRIES) {
          const hidden = lines.length - MAX_LIST_ENTRIES
          return [
            ...lines.slice(0, MAX_LIST_ENTRIES),
            `... and ${hidden} more. List a subfolder to see them.`,
          ].join("\n")
        }
        return lines.join("\n")
      },
    }),

    read_file: tool({
      description:
        "Read a text file from the game directory. Read a file before changing it so the edit matches what is there.",
      inputSchema: z.object({ path: pathInput }),
      execute: async ({ path }) => {
        const absolute = resolveGameFile(path)
        const fs = (await getSandbox()).fs
        const content = await fs
          .downloadFile(absolute)
          .catch((error) => rethrow(error, path))
        if (content.includes(0)) {
          return `${path} is a binary file (${content.length} bytes) and can't be shown as text.`
        }
        if (content.length > MAX_READ_BYTES) {
          return `${content.subarray(0, MAX_READ_BYTES).toString("utf8")}\n\n[Truncated: ${path} is ${content.length} bytes; only the first ${MAX_READ_BYTES} are shown.]`
        }
        return content.toString("utf8")
      },
    }),

    write_file: tool({
      description:
        "Create a file in the game directory, or overwrite one with new contents. Missing parent folders are created. Use replace_text for small edits to an existing file.",
      inputSchema: z.object({
        path: pathInput,
        content: z.string().describe("The file's complete new contents."),
      }),
      execute: async ({ path, content }) => {
        const absolute = resolveGameFile(path)
        const fs = (await getSandbox()).fs
        const file = Buffer.from(content, "utf8")
        await fs.uploadFile(file, absolute)
        return `Wrote ${toGamePath(absolute)} (${file.length} bytes).`
      },
    }),

    replace_text: tool({
      description:
        "Replace exact text in a file in the game directory. old_text must match the file exactly, including whitespace and indentation, and must appear once unless replace_all is set. Include enough surrounding lines to make it unique.",
      inputSchema: z.object({
        path: pathInput,
        old_text: z.string().min(1).describe("The exact text to replace."),
        new_text: z
          .string()
          .describe("The text to put in its place. Empty deletes old_text."),
        replace_all: z
          .boolean()
          .default(false)
          .describe("Replace every occurrence instead of exactly one."),
      }),
      execute: async ({ path, old_text, new_text, replace_all }) => {
        const absolute = resolveGameFile(path)
        const fs = (await getSandbox()).fs
        const content = await fs
          .downloadFile(absolute)
          .catch((error) => rethrow(error, path))

        // split/join rather than String.replace, which reads $ in new_text as
        // a substitution pattern.
        const parts = content.toString("utf8").split(old_text)
        const count = parts.length - 1
        if (count === 0) {
          throw new Error(
            `old_text was not found in ${path}. Read the file and copy the text exactly.`
          )
        }
        if (count > 1 && !replace_all) {
          throw new Error(
            `old_text appears ${count} times in ${path}. Include more surrounding text to pick one, or set replace_all.`
          )
        }

        await fs.uploadFile(Buffer.from(parts.join(new_text), "utf8"), absolute)
        return `Replaced ${count} occurrence${count === 1 ? "" : "s"} in ${toGamePath(absolute)}.`
      },
    }),

    delete_file: tool({
      description:
        "Delete a file, or a folder and everything in it, from the game directory.",
      inputSchema: z.object({ path: pathInput }),
      execute: async ({ path }) => {
        const absolute = resolveGameFile(path)
        const fs = (await getSandbox()).fs
        const { isDir } = await fs
          .getFileDetails(absolute)
          .catch((error) => rethrow(error, path))
        await fs.deleteFile(absolute, isDir)
        return isDir
          ? `Deleted the folder ${toGamePath(absolute)} and everything in it.`
          : `Deleted ${toGamePath(absolute)}.`
      },
    }),
  }
}

// Turns a path from the model, relative to the game directory or absolute
// inside it, into an absolute sandbox path. Anything that resolves outside
// the game directory, such as ../ or /etc, is refused.
function resolveGamePath(path: string) {
  const absolute = posix.resolve(GAME_DIR, path)
  if (absolute !== GAME_DIR && !absolute.startsWith(`${GAME_DIR}/`)) {
    throw new Error(`${path} is outside the game directory.`)
  }
  return absolute
}

// The same, for tools that change one entry and must not take the game
// directory itself.
function resolveGameFile(path: string) {
  const absolute = resolveGamePath(path)
  if (absolute === GAME_DIR) {
    throw new Error(
      "Give a path inside the game directory, not the directory itself."
    )
  }
  return absolute
}

function toGamePath(absolute: string) {
  return posix.relative(GAME_DIR, absolute) || "."
}

// Daytona's not-found errors name the absolute sandbox path; the model works
// in paths relative to the game directory.
function rethrow(error: unknown, path: string): never {
  if (error instanceof DaytonaFileNotFoundError) {
    throw new Error(`${path} does not exist.`)
  }
  throw error
}
