// Small helpers every game reaches for: randomness, easing curves and saved
// data. Nothing here depends on three.js.

export const rand = (min = 0, max = 1) => min + Math.random() * (max - min)

// An integer from min to max, both included.
export const randInt = (min, max) => Math.floor(rand(min, max + 1))

export const pick = (items) => items[Math.floor(Math.random() * items.length)]

export const chance = (probability) => Math.random() < probability

export function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

// A repeatable random number generator (mulberry32): the same seed gives the
// same sequence, for levels that must come out identical every time.
export function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const lerp = (from, to, t) => from + (to - from) * t

// Frame-rate independent smoothing toward a target: higher rates arrive faster.
export const damp = (current, target, rate, dt) =>
  lerp(current, target, 1 - Math.exp(-rate * dt))

// Easing curves for engine.tween(), each mapping 0..1 progress to 0..1.
export const ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => t * (2 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outBounce(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
  },
}

// JSON values saved in the player's browser. Storage can be missing or
// blocked (private windows, embedded previews), so every call is guarded and
// reads fall back instead of throwing.
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(`game:${key}`)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`game:${key}`, JSON.stringify(value))
    } catch {
      // Not saved; the game keeps working without it.
    }
  },
}

// Records a score and returns the best one so far.
export function highScore(score, key = "highScore") {
  const best = Math.max(score, store.get(key, 0))
  store.set(key, best)
  return best
}
