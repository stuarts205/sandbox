import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

import { Sound } from "./engine/audio.js"
import { Engine } from "./engine/engine.js"
import { Particles } from "./engine/particles.js"
import { damp, ease } from "./engine/utils.js"

// The welcome scene a new game opens on: the logo's cube turning in the
// light, waiting for the first prompt. Replace this file with the real game.

// The logo: a white cube on orange, its faces tinted by the orange beneath.
const BRAND = { orange: 0xea580c, peach: 0xfbdecf, apricot: 0xf5ac86, ember: 0xc2410c }

const engine = new Engine({ background: null })
engine.useEnvironment(0.6)
engine.sun.intensity = 2.4
engine.hemisphere.intensity = 0.9
engine.camera.position.set(0, 2.2, 7)

const sound = new Sound()
const particles = new Particles(engine)

const faces = (colors) =>
  colors.map(
    (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 })
  )

// Faces in BoxGeometry order: +x, -x, +y, -y, +z, -z.
const cube = new THREE.Mesh(
  new RoundedBoxGeometry(1.8, 1.8, 1.8, 6, 0.24),
  faces([BRAND.apricot, BRAND.apricot, BRAND.peach, BRAND.peach, BRAND.orange, BRAND.orange])
)
cube.castShadow = true
// Tipped toward the viewer as in the logo, so the peach top shows while the
// cube turns about its own upright axis.
const iso = new THREE.Group()
iso.rotation.x = Math.atan(1 / Math.SQRT2)
iso.add(cube)
const pivot = new THREE.Group()
pivot.position.y = 2
pivot.add(iso)
engine.add(pivot)

// Small cubes circling on a tilted ring.
const ring = new THREE.Group()
ring.position.y = 2
ring.rotation.set(0.35, 0, -0.2)
const smallShape = new RoundedBoxGeometry(0.3, 0.3, 0.3, 3, 0.06)
const smallFaces = faces([BRAND.orange, BRAND.peach, BRAND.apricot, BRAND.ember])
for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2
  const small = new THREE.Mesh(smallShape, smallFaces[i % smallFaces.length])
  small.position.set(Math.cos(angle) * 2.7, Math.sin(angle * 3) * 0.25, Math.sin(angle) * 2.7)
  small.rotation.set(angle, angle * 2, 0)
  small.castShadow = true
  ring.add(small)
}
engine.add(ring)

// Catches the shadows on a floor that is otherwise invisible.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2),
  new THREE.ShadowMaterial({ opacity: 0.18 })
)
floor.receiveShadow = true
engine.add(floor)

// The cube leans toward the pointer and pops when clicked.
const tilt = new THREE.Vector2()
let pops = 0

engine.onUpdate((dt, time) => {
  const { position, clicked } = engine.input.pointer
  tilt.x = damp(tilt.x, -position.y * 0.5, 4, dt)
  tilt.y = damp(tilt.y, position.x * 0.7, 4, dt)

  cube.rotation.y = Math.PI / 4 + time * 0.6
  pivot.rotation.set(tilt.x, tilt.y, 0)
  pivot.position.y = 2 + Math.sin(time * 1.4) * 0.15
  ring.rotation.y = -time * 0.3
  for (const small of ring.children) small.rotation.y += dt * 1.5

  if (clicked && engine.pick([cube])) pop()

  // Pull the camera back on narrow screens so the ring stays in view.
  engine.camera.position.z = 7 * Math.max(1, 1.2 / engine.camera.aspect)
  engine.camera.lookAt(0, 1.3, 0)
})

async function pop() {
  pops++
  sound.play(pops % 5 === 0 ? "win" : "powerup")
  const origin = cube.getWorldPosition(new THREE.Vector3())
  particles.burst(origin, { count: 40, color: BRAND.orange, speed: 7 })
  particles.burst(origin, { count: 20, color: BRAND.peach, speed: 5 })
  cube.scale.setScalar(1.25)
  await engine.tween(cube.scale, { x: 1, y: 1, z: 1 }, 0.5, { easing: ease.outBack })
}

engine.start()
