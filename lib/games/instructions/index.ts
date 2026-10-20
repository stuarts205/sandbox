import { engine } from "./engine"
import { runtime } from "./runtime"
import { workflow } from "./workflow"

// The game agent's instructions, in the order the system prompt joins them.
export const gameInstructions = [workflow, runtime, engine]
