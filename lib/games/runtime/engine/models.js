import * as THREE from "three"

// Ready-made low-poly models built from three.js primitives, so a game has
// something good to look at before it has any art.
//
// - Every model's origin is the centre of its base: at y = 0 it stands on the
//   ground, and turning it about y spins it in place.
// - Models face +z, so model.rotation.y = Math.atan2(dir.x, dir.z) turns one
//   to face a direction.
// - Geometries and materials are cached and shared between models. Never
//   dispose them when a model is removed; other models still use them.

export const palette = {
  grass: 0x6cbf4b,
  dirt: 0x8b6b4a,
  sand: 0xe8d39a,
  water: 0x3fa7d6,
  stone: 0x9a9a9a,
  wood: 0x9c6b3c,
  leaf: 0x3f9b4b,
  gold: 0xf5c542,
  red: 0xe5484d,
  orange: 0xea580c,
  blue: 0x3e7bfa,
  purple: 0x8e4ec6,
  white: 0xf2f2f2,
  dark: 0x2b2b2b,
}

const materials = new Map()
const geometries = new Map()
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x4a3018 })

// A shared MeshStandardMaterial. flat gives the faceted low-poly look.
export function material(
  color,
  { roughness = 0.8, metalness = 0, emissive = 0x000000, flat = false } = {}
) {
  const key = `${color}|${roughness}|${metalness}|${emissive}|${flat}`
  if (!materials.has(key)) {
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive,
        flatShading: flat,
      })
    )
  }
  return materials.get(key)
}

function geometry(key, build) {
  if (!geometries.has(key)) geometries.set(key, build())
  return geometries.get(key)
}

function mesh(shape, surface) {
  const result = new THREE.Mesh(shape, surface)
  result.castShadow = true
  result.receiveShadow = true
  return result
}

// Takes either a material from material() or a color for a plain one.
const surface = (color) => (color?.isMaterial ? color : material(color))

// --- Primitives ---------------------------------------------------------

export function box({ width = 1, height = 1, depth = 1, color = palette.blue } = {}) {
  const shape = geometry(`box|${width}|${height}|${depth}`, () =>
    new THREE.BoxGeometry(width, height, depth).translate(0, height / 2, 0)
  )
  return mesh(shape, surface(color))
}

export function sphere({ radius = 0.5, color = palette.blue } = {}) {
  const shape = geometry(`sphere|${radius}`, () =>
    new THREE.SphereGeometry(radius, 32, 16).translate(0, radius, 0)
  )
  return mesh(shape, surface(color))
}

export function cylinder({
  radiusTop = 0.5,
  radiusBottom = radiusTop,
  height = 1,
  segments = 24,
  color = palette.blue,
} = {}) {
  const shape = geometry(`cylinder|${radiusTop}|${radiusBottom}|${height}|${segments}`, () =>
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments).translate(0, height / 2, 0)
  )
  return mesh(shape, surface(color))
}

export function cone({ radius = 0.5, height = 1, segments = 24, color = palette.blue } = {}) {
  const shape = geometry(`cone|${radius}|${height}|${segments}`, () =>
    new THREE.ConeGeometry(radius, height, segments).translate(0, height / 2, 0)
  )
  return mesh(shape, surface(color))
}

// height is the full height, rounded ends included.
export function capsule({ radius = 0.4, height = 1.6, color = palette.blue } = {}) {
  const shape = geometry(`capsule|${radius}|${height}`, () =>
    new THREE.CapsuleGeometry(radius, Math.max(height - radius * 2, 0), 8, 16).translate(
      0,
      height / 2,
      0
    )
  )
  return mesh(shape, surface(color))
}

// A ring standing upright, facing +z.
export function torus({ radius = 0.5, tube = 0.15, color = palette.gold } = {}) {
  const shape = geometry(`torus|${radius}|${tube}`, () =>
    new THREE.TorusGeometry(radius, tube, 16, 48).translate(0, radius + tube, 0)
  )
  return mesh(shape, surface(color))
}

// A flat square floor with its top at y = 0. It receives shadows but casts none.
export function ground({ size = 100, color = palette.grass } = {}) {
  const shape = geometry(`ground|${size}`, () =>
    new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2)
  )
  const floor = new THREE.Mesh(shape, surface(color))
  floor.receiveShadow = true
  return floor
}

// --- Models -------------------------------------------------------------

// A capsule body with eyes on the front: a player, an enemy or an NPC.
export function character({ color = palette.blue, height = 1.6 } = {}) {
  const group = new THREE.Group()
  const radius = height * 0.25
  group.add(capsule({ radius, height, color }))

  const eyeRadius = radius * 0.24
  const pupilRadius = eyeRadius * 0.55
  for (const side of [-1, 1]) {
    const eye = sphere({ radius: eyeRadius, color: palette.white })
    eye.position.set(side * radius * 0.42, height * 0.7 - eyeRadius, radius * 0.82)
    const pupil = sphere({ radius: pupilRadius, color: palette.dark })
    pupil.position.set(0, eyeRadius - pupilRadius, eyeRadius * 0.7)
    eye.add(pupil)
    group.add(eye)
  }
  return group
}

export function tree({ height = 3, color = palette.leaf } = {}) {
  const group = new THREE.Group()
  const leaves = material(color, { flat: true })
  const trunk = cylinder({
    radiusTop: height * 0.05,
    radiusBottom: height * 0.07,
    height: height * 0.4,
    segments: 6,
    color: palette.wood,
  })
  group.add(trunk)

  const lower = cone({ radius: height * 0.32, height: height * 0.5, segments: 7, color: leaves })
  lower.position.y = height * 0.28
  const upper = cone({ radius: height * 0.23, height: height * 0.42, segments: 7, color: leaves })
  upper.position.y = height * 0.58
  group.add(lower, upper)
  return group
}

export function rock({ size = 1, color = palette.stone } = {}) {
  const shape = geometry(`rock|${size}`, () =>
    new THREE.DodecahedronGeometry(size / 2, 0).translate(0, size * 0.35, 0)
  )
  const result = mesh(shape, material(color, { flat: true }))
  result.scale.set(1, 0.7, 0.85)
  return result
}

// A wooden box with dark edges.
export function crate({ size = 1, color = palette.wood } = {}) {
  const result = box({ width: size, height: size, depth: size, color })
  const edges = geometry(`crate-edges|${size}`, () => new THREE.EdgesGeometry(result.geometry))
  result.add(new THREE.LineSegments(edges, edgeMaterial))
  return result
}

// A spinning-ready gold coin floating above its origin.
export function coin({ color = palette.gold } = {}) {
  const shape = geometry("coin", () =>
    new THREE.CylinderGeometry(0.35, 0.35, 0.08, 24).rotateX(Math.PI / 2).translate(0, 0.7, 0)
  )
  const group = new THREE.Group()
  group.add(mesh(shape, material(color, { roughness: 0.3, metalness: 0.6, emissive: 0x3a2a00 })))
  return group
}

// A floating faceted crystal, for collectibles and power-ups.
export function gem({ color = palette.purple, size = 0.6 } = {}) {
  const shape = geometry(`gem|${size}`, () =>
    new THREE.OctahedronGeometry(size / 2, 0).scale(0.7, 1, 0.7).translate(0, size + 0.3, 0)
  )
  const glow = new THREE.Color(color).multiplyScalar(0.25).getHex()
  const group = new THREE.Group()
  group.add(mesh(shape, material(color, { roughness: 0.2, metalness: 0.1, emissive: glow, flat: true })))
  return group
}

// A pole with a pennant: a goal, checkpoint or finish line.
export function flag({ height = 2, color = palette.red } = {}) {
  const group = new THREE.Group()
  group.add(cylinder({ radiusTop: 0.04, height, segments: 8, color: palette.white }))
  const cloth = box({ width: 0.8, height: 0.5, depth: 0.03, color })
  cloth.position.set(0.4, height - 0.55, 0)
  group.add(cloth)
  return group
}

// A camera-facing text sprite above its origin, for names, damage numbers
// and signs. Each label owns its texture: when removing one for good, call
// label.material.map.dispose() and label.material.dispose().
export function label(text, { color = "#ffffff", background = "rgba(0, 0, 0, 0.55)", height = 0.5 } = {}) {
  const font = "600 48px system-ui, sans-serif"
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")
  context.font = font
  canvas.width = Math.ceil(context.measureText(text).width) + 48
  canvas.height = 72
  context.font = font
  context.fillStyle = background
  context.beginPath()
  context.roundRect(0, 0, canvas.width, canvas.height, 24)
  context.fill()
  context.fillStyle = color
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }))
  sprite.center.set(0.5, 0)
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1)
  return sprite
}

// --- Layout -------------------------------------------------------------

// count copies of a model spread at random over a square area wide, turned
// and sized a little differently each, keeping clear units free around the
// centre for the player. Extra options go to the factory. Returns a Group.
export function scatter(factory, count, { area = 60, clear = 0, ...options } = {}) {
  const group = new THREE.Group()
  for (let i = 0; i < count; i++) {
    const model = factory(options)
    let x, z
    do {
      x = THREE.MathUtils.randFloatSpread(area)
      z = THREE.MathUtils.randFloatSpread(area)
    } while (Math.hypot(x, z) < clear)
    model.position.set(x, 0, z)
    model.rotation.y = Math.random() * Math.PI * 2
    model.scale.multiplyScalar(THREE.MathUtils.randFloat(0.8, 1.25))
    group.add(model)
  }
  return group
}
