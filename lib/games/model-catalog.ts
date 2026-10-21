// The models a game can be built with. Client-safe: ids and copy only, so the
// UI can list them. The provider instances live in ./models.
export const gameModels = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    tagline: "The most capable. Best for big, ambitious games.",
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    tagline: "Fast and capable. A good balance for most games.",
  },
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    tagline: "The fastest. Best for small games and quick tweaks.",
  },
] as const

export type GameModelId = (typeof gameModels)[number]["id"]

export const gameModelIds = gameModels.map((model) => model.id) as [
  GameModelId,
  ...GameModelId[],
]

export const defaultGameModelId: GameModelId = "claude-opus-5-5"

export function isGameModelId(value: unknown): value is GameModelId {
  return gameModelIds.includes(value as GameModelId)
}
