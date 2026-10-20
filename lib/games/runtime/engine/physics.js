import * as THREE from "three"

// Simple arcade physics: gravity, a floor, and bodies that slide along and
// land on solid boxes. Everything is an axis-aligned box, which is enough for
// platformers, mazes and arenas; a rotated solid blocks the upright box that
// encloses it.
//
//   const physics = new Physics()
//   physics.addSolid(platform)
//   const body = physics.addBody(player)
//   engine.onUpdate((dt) => {
//     body.velocity.x = move.x * 6
//     if (body.onGround && input.wasPressed(KEYS.jump)) body.velocity.y = 10
//     physics.step(dt)
//   })
export class Physics {
  constructor({ gravity = -30, floor = 0 } = {}) {
    this.gravity = gravity
    this.floor = floor // the height of an endless floor, or null for none
    this.solids = new Map()
    this.bodies = new Set()
  }

  // Makes an object (and its children) solid. Call refresh(object) after
  // moving it, e.g. on every frame for a moving platform.
  addSolid(object) {
    this.solids.set(object, new THREE.Box3())
    this.refresh(object)
    return object
  }

  removeSolid(object) {
    this.solids.delete(object)
  }

  refresh(object) {
    object.updateWorldMatrix(true, true)
    this.solids.get(object)?.setFromObject(object)
  }

  // A moving box the size of the object, with its origin at the base centre
  // the way every model in models.js has. Set body.velocity to move it.
  addBody(object, { width = 0.8, height = 1.6, depth = width, gravity = true } = {}) {
    const body = {
      object,
      size: new THREE.Vector3(width, height, depth),
      velocity: new THREE.Vector3(),
      gravity,
      onGround: false,
      box: new THREE.Box3(),
    }
    this.bodies.add(body)
    return body
  }

  removeBody(body) {
    this.bodies.delete(body)
  }

  // The solids a body is touching or overlapping, for "is the player on the
  // ice" or "did the ball hit a brick" checks.
  touching(body) {
    this.#fit(body, 0.02)
    const result = []
    for (const [object, box] of this.solids) if (box.intersectsBox(body.box)) result.push(object)
    return result
  }

  step(dt) {
    for (const body of this.bodies) {
      if (body.gravity) body.velocity.y += this.gravity * dt
      body.onGround = false
      // One axis at a time, so a body slides along a wall it runs into.
      this.#move(body, "x", body.velocity.x * dt)
      this.#move(body, "z", body.velocity.z * dt)
      this.#move(body, "y", body.velocity.y * dt)

      const position = body.object.position
      if (this.floor !== null && position.y <= this.floor) {
        position.y = this.floor
        body.velocity.y = Math.max(body.velocity.y, 0)
        body.onGround = true
      }
    }
  }

  #move(body, axis, distance) {
    if (distance === 0) return
    const position = body.object.position
    position[axis] += distance
    this.#fit(body)
    for (const box of this.solids.values()) {
      if (!box.intersectsBox(body.box)) continue
      // Push the body back out on the side it came from and stop it there.
      const half = axis === "y" ? 0 : body.size[axis] / 2
      if (distance > 0) {
        position[axis] = box.min[axis] - (axis === "y" ? body.size.y : half)
      } else {
        position[axis] = box.max[axis] + half
        if (axis === "y") body.onGround = true
      }
      body.velocity[axis] = 0
      this.#fit(body)
    }
  }

  // The body's box from its position, shrunk a hair so a body resting
  // exactly against a solid does not count as inside it.
  #fit(body, grow = -0.001) {
    const { x, y, z } = body.object.position
    const { x: width, y: height, z: depth } = body.size
    body.box.min.set(x - width / 2 - grow, y - grow, z - depth / 2 - grow)
    body.box.max.set(x + width / 2 + grow, y + height + grow, z + depth / 2 + grow)
  }
}
