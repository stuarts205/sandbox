import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js"

// Player input and camera rigs. The engine owns one Input (engine.input);
// the rigs are opt-in, one per game, chosen to suit its camera.

export const KEYS = {
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  jump: ["Space"],
  action: ["KeyE", "Enter"],
  pause: ["KeyP", "Escape"],
}

// Keys that would otherwise scroll the page or the preview around it.
const CAPTURED = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])

const UP = new THREE.Vector3(0, 1, 0)
const forward = new THREE.Vector3()
const right = new THREE.Vector3()
const axes = new THREE.Vector2()

// Keyboard and pointer state, polled from the update loop. isDown() is true
// while a key is held; wasPressed() and pointer.clicked are true only on the
// frame the press happened, because the engine clears them after every frame.
export class Input {
  constructor(element) {
    this.element = element
    this.down = new Set()
    this.pressed = new Set()
    this.pointer = {
      position: new THREE.Vector2(), // normalized device coordinates, -1..1
      down: false,
      clicked: false,
    }

    window.addEventListener("keydown", (event) => {
      if (CAPTURED.has(event.code)) event.preventDefault()
      if (!event.repeat) this.pressed.add(event.code)
      this.down.add(event.code)
    })
    window.addEventListener("keyup", (event) => this.down.delete(event.code))
    // Keys released while the window is unfocused never send keyup.
    window.addEventListener("blur", () => this.down.clear())

    element.addEventListener("pointermove", (event) => this.#track(event))
    element.addEventListener("pointerdown", (event) => {
      this.#track(event)
      this.pointer.down = true
      this.pointer.clicked = true
    })
    window.addEventListener("pointerup", () => (this.pointer.down = false))
  }

  isDown(...codes) {
    return codes.flat().some((code) => this.down.has(code))
  }

  wasPressed(...codes) {
    return codes.flat().some((code) => this.pressed.has(code))
  }

  // -1, 0 or 1 from a pair of key lists, e.g. axis(KEYS.left, KEYS.right).
  axis(negative, positive) {
    return Number(this.isDown(positive)) - Number(this.isDown(negative))
  }

  // WASD or the arrow keys as x (right) and y (forward), never longer than 1
  // so diagonals are no faster than straight lines.
  move(target = new THREE.Vector2()) {
    target.set(this.axis(KEYS.left, KEYS.right), this.axis(KEYS.back, KEYS.forward))
    if (target.lengthSq() > 1) target.normalize()
    return target
  }

  // The move keys as a direction on the ground plane relative to the camera,
  // so forward always walks away from the camera whichever way it faces.
  moveRelativeTo(camera, target = new THREE.Vector3()) {
    const { x, y } = this.move(axes)
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, UP)
    return target.copy(forward).multiplyScalar(y).addScaledVector(right, x)
  }

  endFrame() {
    this.pressed.clear()
    this.pointer.clicked = false
  }

  #track(event) {
    const rect = this.element.getBoundingClientRect()
    this.pointer.position.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
  }
}

// A third-person camera that trails a target and eases into place. The
// offset is in world space, which suits moveRelativeTo(); with rotate it
// turns with the target instead, for a chase camera behind a vehicle.
export class FollowCamera {
  constructor(
    camera,
    target,
    { offset = [0, 6, 10], look = [0, 1, 0], stiffness = 5, rotate = false } = {}
  ) {
    this.camera = camera
    this.target = target
    this.offset = new THREE.Vector3(...offset)
    this.look = new THREE.Vector3(...look)
    this.stiffness = stiffness
    this.rotate = rotate
    this.desired = new THREE.Vector3()
    this.focus = new THREE.Vector3()
  }

  update(dt) {
    this.#aim()
    this.camera.position.lerp(this.desired, 1 - Math.exp(-this.stiffness * dt))
    this.camera.lookAt(this.focus)
  }

  // Jumps straight to the resting position, for the first frame or a respawn.
  snap() {
    this.#aim()
    this.camera.position.copy(this.desired)
    this.camera.lookAt(this.focus)
  }

  #aim() {
    this.target.getWorldPosition(this.focus)
    this.desired.copy(this.offset)
    if (this.rotate) this.desired.applyQuaternion(this.target.quaternion)
    this.desired.add(this.focus)
    this.focus.add(this.look)
  }
}

// Drag to orbit, wheel or pinch to zoom: for board, puzzle and builder games
// viewed from above. Keeps easing while the engine is paused.
export function orbitControls(
  engine,
  { target = [0, 0, 0], minDistance = 3, maxDistance = 60, maxPolarAngle = Math.PI / 2.1 } = {}
) {
  const controls = new OrbitControls(engine.camera, engine.renderer.domElement)
  controls.enableDamping = true
  controls.target.set(...target)
  controls.minDistance = minDistance
  controls.maxDistance = maxDistance
  controls.maxPolarAngle = maxPolarAngle
  engine.onUpdate((dt) => controls.update(dt), { always: true })
  return controls
}

// Mouse look with the pointer locked, WASD to walk: for first-person games.
// The pointer locks on a click on the canvas and Escape releases it, so show
// the player a "click to play" prompt while controls.isLocked is false.
export function firstPerson(engine, { speed = 6, height = 1.7 } = {}) {
  const controls = new PointerLockControls(engine.camera, engine.renderer.domElement)
  engine.renderer.domElement.addEventListener("click", () => controls.lock())
  engine.camera.position.y = height

  engine.onUpdate((dt) => {
    if (!controls.isLocked) return
    const { x, y } = engine.input.move(axes)
    controls.moveForward(y * speed * dt)
    controls.moveRight(x * speed * dt)
  })
  return controls
}
