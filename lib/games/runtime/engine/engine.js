import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"

import { Input } from "./controls.js"
import { ease } from "./utils.js"

// Where the sun sits relative to the point its shadows are centred on.
const SUN_OFFSET = new THREE.Vector3(12, 20, 8)
// Half the width of the square the sun's shadows cover, in world units.
const SHADOW_EXTENT = 30

const raycaster = new THREE.Raycaster()
const positionA = new THREE.Vector3()
const positionB = new THREE.Vector3()

// The core of every game: one renderer, scene and camera filling the #game
// element, a sky-and-sun light rig, the player's input and the frame loop.
//
// Each frame runs, in order: timers and tweens, then onUpdate callbacks in the
// order they were added, then the update functions of objects added with
// add(object, update), then the render. Pausing stops all of it except the
// render and callbacks added with { always: true }.
export class Engine {
  constructor({
    container = document.getElementById("game"),
    background = 0x9fc9eb, // a color, or null for a transparent canvas
    fog = true,
    shadows = true,
    fov = 60,
    maxDelta = 1 / 20, // a long frame (tab switch, breakpoint) counts as this
  } = {}) {
    this.container = container
    this.maxDelta = maxDelta
    this.paused = false
    this.time = 0

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: background === null })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.shadowMap.enabled = shadows
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    if (background !== null) {
      this.scene.background = new THREE.Color(background)
      if (fog) this.scene.fog = new THREE.Fog(background, 40, 140)
    }

    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500)
    this.camera.position.set(0, 6, 10)
    this.camera.lookAt(0, 0, 0)

    this.hemisphere = new THREE.HemisphereLight(0xe8f2ff, 0x6b5a48, 1.1)
    this.sun = new THREE.DirectionalLight(0xfff4e5, 2)
    this.sun.castShadow = shadows
    const shadow = this.sun.shadow
    shadow.mapSize.set(2048, 2048)
    shadow.camera.left = shadow.camera.bottom = -SHADOW_EXTENT
    shadow.camera.right = shadow.camera.top = SHADOW_EXTENT
    shadow.camera.near = 1
    shadow.camera.far = 80
    shadow.normalBias = 0.03
    this.scene.add(this.hemisphere, this.sun, this.sun.target)
    this.focusShadows(new THREE.Vector3())

    this.input = new Input(this.renderer.domElement)
    this.timer = new THREE.Timer()
    this.timer.connect(document) // no giant delta after the tab was hidden

    this.updaters = new Set()
    this.alwaysUpdaters = new Set()
    this.objectUpdaters = new Map()
    this.timers = new Set()

    this.resize()
    new ResizeObserver(() => this.resize()).observe(container)
  }

  start() {
    this.renderer.setAnimationLoop(this.#frame)
    return this
  }

  stop() {
    this.renderer.setAnimationLoop(null)
  }

  // Runs fn(dt, time) every frame; returns a function that unsubscribes it.
  onUpdate(fn, { always = false } = {}) {
    const set = always ? this.alwaysUpdaters : this.updaters
    set.add(fn)
    return () => set.delete(fn)
  }

  // Adds an object to the scene, optionally with update(object, dt, time) run
  // every frame until it is removed. Returns the object.
  add(object, update) {
    this.scene.add(object)
    if (update) this.objectUpdaters.set(object, update)
    return object
  }

  remove(object) {
    object.removeFromParent()
    this.objectUpdaters.delete(object)
  }

  // Calls fn once, after the given seconds of unpaused game time. Returns a
  // function that cancels it.
  after(seconds, fn) {
    const timer = { at: this.time + seconds, fn }
    this.timers.add(timer)
    return () => this.timers.delete(timer)
  }

  // Calls fn every interval seconds of unpaused game time, until cancelled.
  every(seconds, fn) {
    const timer = { at: this.time + seconds, fn, interval: seconds }
    this.timers.add(timer)
    return () => this.timers.delete(timer)
  }

  // Animates numeric properties of target to the values in to, e.g.
  // tween(mesh.position, { y: 2 }, 0.4). Resolves when it finishes.
  tween(target, to, duration, { easing = ease.inOut, delay = 0 } = {}) {
    return new Promise((resolve) => {
      const from = {}
      const start = this.time + delay
      const timer = {
        at: start,
        tween: true,
        fn: () => {
          for (const key in to) from[key] ??= target[key]
          const t = Math.min((this.time - start) / duration, 1)
          const k = easing(t)
          for (const key in to) target[key] = from[key] + (to[key] - from[key]) * k
          if (t < 1) return
          this.timers.delete(timer)
          resolve()
        },
      }
      this.timers.add(timer)
    })
  }

  // The nearest hit under the pointer among objects (searched with their
  // children), or null. Check engine.input.pointer.clicked first for clicks.
  pick(objects) {
    raycaster.setFromCamera(this.input.pointer.position, this.camera)
    return raycaster.intersectObjects(objects, true)[0] ?? null
  }

  // Centres the sun's shadow area on a point. The shadows cover a square
  // SHADOW_EXTENT units either side, so call this each frame with the
  // player's position in a world larger than that.
  focusShadows(position) {
    this.sun.target.position.copy(position)
    this.sun.position.copy(position).add(SUN_OFFSET)
  }

  // Studio reflections for shiny materials (metal, clearcoat), generated in
  // the browser rather than loaded from a file.
  useEnvironment(intensity = 0.5) {
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.scene.environment = pmrem.fromScene(room, 0.04).texture
    this.scene.environmentIntensity = intensity
    room.dispose()
    pmrem.dispose()
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container
    if (!width || !height) return
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  #frame = () => {
    this.timer.update()
    const dt = Math.min(this.timer.getDelta(), this.maxDelta)

    if (!this.paused) {
      this.time += dt
      for (const timer of this.timers) {
        if (this.time < timer.at) continue
        if (timer.tween) timer.fn()
        else if (timer.interval) {
          timer.at += timer.interval
          timer.fn()
        } else {
          this.timers.delete(timer)
          timer.fn()
        }
      }
      for (const fn of this.updaters) fn(dt, this.time)
      for (const [object, update] of this.objectUpdaters) update(object, dt, this.time)
    }
    for (const fn of this.alwaysUpdaters) fn(dt, this.time)

    this.input.endFrame()
    this.renderer.render(this.scene, this.camera)
  }
}

// True when the world positions of two objects are within distance of each
// other: the quick check for pickups, hits and reaching a goal.
export function overlaps(a, b, distance) {
  a.getWorldPosition(positionA)
  b.getWorldPosition(positionB)
  return positionA.distanceToSquared(positionB) < distance * distance
}
