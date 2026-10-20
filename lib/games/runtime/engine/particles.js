import * as THREE from "three"

const matrix = new THREE.Matrix4()
const rotation = new THREE.Quaternion()
const scale = new THREE.Vector3()
const color = new THREE.Color()
const spin = new THREE.Euler()

// Bursts of small tumbling cubes for pickups, hits, explosions and dust,
// drawn as one InstancedMesh so thousands cost a single draw call.
//
//   const particles = new Particles(engine)
//   particles.burst(coin.position, { color: 0xf5c542 })
export class Particles {
  constructor(engine, { max = 2000 } = {}) {
    this.max = max
    this.live = []
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      max
    )
    this.mesh.frustumCulled = false // instances fly far from the mesh origin
    this.mesh.castShadow = true
    // Colors must exist before the first render, or the shader is built
    // without them.
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, color.set(0xffffff))
    this.mesh.count = 0
    engine.scene.add(this.mesh)
    engine.onUpdate((dt) => this.update(dt))
  }

  burst(
    position,
    {
      count = 24,
      color: tint = 0xffd34d,
      speed = 5,
      size = 0.15,
      life = 0.8,
      gravity = -14,
      upward = 0.6, // 0 sprays evenly in all directions, 1 straight up
    } = {}
  ) {
    for (let i = 0; i < count && this.live.length < this.max; i++) {
      const velocity = new THREE.Vector3().randomDirection()
      velocity.y = Math.abs(velocity.y) * upward + velocity.y * (1 - upward)
      velocity.multiplyScalar(speed * (0.5 + Math.random() * 0.5))
      this.live.push({
        position: new THREE.Vector3().copy(position),
        velocity,
        rotation: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(6),
        age: 0,
        life: life * (0.6 + Math.random() * 0.4),
        size: size * (0.6 + Math.random() * 0.8),
        gravity,
        color: new THREE.Color(tint),
      })
    }
  }

  update(dt) {
    let alive = 0
    for (const particle of this.live) {
      particle.age += dt
      if (particle.age >= particle.life) continue
      particle.velocity.y += particle.gravity * dt
      particle.position.addScaledVector(particle.velocity, dt)

      const t = particle.age
      spin.set(particle.rotation.x * t, particle.rotation.y * t, particle.rotation.z * t)
      rotation.setFromEuler(spin)
      scale.setScalar(particle.size * (1 - particle.age / particle.life))
      matrix.compose(particle.position, rotation, scale)
      this.mesh.setMatrixAt(alive, matrix)
      this.mesh.setColorAt(alive, particle.color)
      this.live[alive++] = particle
    }
    this.live.length = alive
    this.mesh.count = alive
    this.mesh.instanceMatrix.needsUpdate = true
    this.mesh.instanceColor.needsUpdate = true
  }
}
