import { store } from "./utils.js"

// Sound effects and music synthesized with the Web Audio API, so a game has
// sound without any audio files. Browsers start audio only after the player
// interacts with the page; until their first key press or click, play() and
// friends do nothing and music() waits, then starts by itself.

const NOTE_INDEX = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }

// The frequency of a note name such as "A4", "C#5" or "Eb3".
export function note(name) {
  const [, letter, accidental, octave] = /^([A-G])([#b]?)(-?\d)$/.exec(name)
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0
  const semitones = NOTE_INDEX[letter] + shift + (Number(octave) - 4) * 12
  return 440 * 2 ** (semitones / 12)
}

// Built-in effects for play(name). Each one is made of tones and noise.
const EFFECTS = {
  coin: (s) => {
    s.tone({ frequency: note("B5"), duration: 0.08, type: "square", volume: 0.2 })
    s.tone({ frequency: note("E6"), duration: 0.25, type: "square", volume: 0.2, delay: 0.08 })
  },
  jump: (s) => s.tone({ frequency: 260, to: 620, duration: 0.18, type: "square", volume: 0.18 }),
  shoot: (s) => s.tone({ frequency: 980, to: 180, duration: 0.15, type: "sawtooth", volume: 0.15 }),
  hit: (s) => {
    s.noise({ duration: 0.12, volume: 0.35, filter: 2400 })
    s.tone({ frequency: 180, to: 60, duration: 0.15, type: "square", volume: 0.2 })
  },
  explosion: (s) => s.noise({ duration: 0.9, volume: 0.5, filter: 1600, filterTo: 80 }),
  powerup: (s) => {
    ;["C5", "E5", "G5", "C6"].forEach((name, i) =>
      s.tone({ frequency: note(name), duration: 0.1, type: "triangle", volume: 0.25, delay: i * 0.07 })
    )
  },
  click: (s) => s.tone({ frequency: 1200, duration: 0.03, type: "square", volume: 0.1 }),
  win: (s) => {
    ;["C5", "E5", "G5", "C6", "G5", "C6"].forEach((name, i) =>
      s.tone({ frequency: note(name), duration: 0.16, type: "triangle", volume: 0.25, delay: i * 0.12 })
    )
  },
  lose: (s) => {
    ;["G4", "E4", "C4"].forEach((name, i) =>
      s.tone({ frequency: note(name), duration: 0.3, type: "triangle", volume: 0.25, delay: i * 0.22 })
    )
    s.tone({ frequency: note("C4"), to: note("C3"), duration: 0.6, type: "sawtooth", volume: 0.12, delay: 0.66 })
  },
}

export class Sound {
  #muted = false

  constructor({ volume = 0.6 } = {}) {
    this.context = null
    this.volume = volume
    this.buffers = new Map()
    this.pending = new Map()
    this.#muted = store.get("muted", false)

    // Capture phase, so the context exists before the game's own handler for
    // the same event calls play().
    const unlock = () => {
      if (this.context) return this.context.resume()
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = this.#muted ? 0 : this.volume
      this.master.connect(this.context.destination)
      this.#decodePending()
    }
    window.addEventListener("pointerdown", unlock, { capture: true })
    window.addEventListener("keydown", unlock, { capture: true })
  }

  get muted() {
    return this.#muted
  }

  // Remembered across visits, so a muted game stays muted.
  set muted(value) {
    this.#muted = value
    store.set("muted", value)
    if (this.master) this.master.gain.value = value ? 0 : this.volume
  }

  toggleMute() {
    this.muted = !this.muted
    return this.muted
  }

  // A built-in effect (see EFFECTS: coin, jump, shoot, hit, explosion,
  // powerup, click, win, lose) or a file registered with load().
  play(name, { volume = 1, rate = 1 } = {}) {
    if (!this.context) return
    const buffer = this.buffers.get(name)
    if (buffer) {
      const source = this.context.createBufferSource()
      const gain = this.context.createGain()
      source.buffer = buffer
      source.playbackRate.value = rate
      gain.gain.value = volume
      source.connect(gain).connect(this.master)
      source.start()
      return
    }
    EFFECTS[name]?.(this)
  }

  // Registers an audio file (relative path) under a name for play(name).
  async load(name, url) {
    const data = await (await fetch(url)).arrayBuffer()
    if (this.context) this.buffers.set(name, await this.context.decodeAudioData(data))
    else this.pending.set(name, data)
  }

  // One synthesized note. to slides the pitch over the duration.
  tone({ frequency = 440, to, duration = 0.15, type = "square", volume = 0.3, delay = 0 } = {}) {
    if (!this.context) return
    const start = this.context.currentTime + delay
    const oscillator = this.context.createOscillator()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (to) oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)
    const gain = this.#envelope(start, duration, volume)
    oscillator.connect(gain)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.05)
  }

  // A burst of filtered white noise: hits, explosions, wind. filterTo sweeps
  // the low-pass cutoff, from bright to muffled for a falling explosion.
  noise({ duration = 0.3, volume = 0.3, filter = 1200, filterTo, delay = 0 } = {}) {
    if (!this.context) return
    const start = this.context.currentTime + delay
    const source = this.context.createBufferSource()
    source.buffer = this.#noiseBuffer()
    source.loop = true
    const lowpass = this.context.createBiquadFilter()
    lowpass.type = "lowpass"
    lowpass.frequency.setValueAtTime(filter, start)
    if (filterTo) lowpass.frequency.exponentialRampToValueAtTime(filterTo, start + duration)
    source.connect(lowpass).connect(this.#envelope(start, duration, volume))
    source.start(start)
    source.stop(start + duration + 0.05)
  }

  // Loops a melody: notes are names ("E4"), frequencies, or null for a rest,
  // one per beat. Returns a function that stops it. Starts once the player
  // has interacted, if they have not yet.
  music(notes, { bpm = 120, type = "triangle", volume = 0.12, beat = 0.5 } = {}) {
    const step = (60 / bpm) * beat
    let index = 0
    let nextAt = 0
    const schedule = () => {
      if (!this.context) return
      if (nextAt === 0) nextAt = this.context.currentTime + 0.05
      // Look ahead a little, so notes stay on the beat when the timer is late.
      while (nextAt < this.context.currentTime + 0.2) {
        const value = notes[index % notes.length]
        if (value !== null) {
          const frequency = typeof value === "number" ? value : note(value)
          this.tone({
            frequency,
            duration: step * 0.9,
            type,
            volume,
            delay: nextAt - this.context.currentTime,
          })
        }
        index++
        nextAt += step
      }
    }
    const interval = setInterval(schedule, 50)
    return () => clearInterval(interval)
  }

  // A gain node shaped as a quick attack and an exponential fade, connected
  // to the master volume.
  #envelope(start, duration, volume) {
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    gain.connect(this.master)
    return gain
  }

  #noiseBuffer() {
    if (this.noiseCache) return this.noiseCache
    const length = this.context.sampleRate
    this.noiseCache = this.context.createBuffer(1, length, this.context.sampleRate)
    const samples = this.noiseCache.getChannelData(0)
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1
    return this.noiseCache
  }

  async #decodePending() {
    for (const [name, data] of this.pending) {
      this.buffers.set(name, await this.context.decodeAudioData(data))
    }
    this.pending.clear()
  }
}
