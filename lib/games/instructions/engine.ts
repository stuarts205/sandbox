// The game engine seeded into every game directory (lib/games/runtime/engine):
// what each module offers and how a game is put together from them.
export const engine = `
# Engine

Every game starts with a small three.js engine in \`engine/\`. Build games on it
instead of writing renderer, input, HUD or sound code from scratch: it is already
tested, and games built the same way are easier to change later. Read a module
before relying on a detail this summary leaves out. You may extend or fix an
engine file when a game needs something it lacks; keep its existing API working.

New games are 3D unless the user asks otherwise. For a 2D-style game, use the
same engine with a fixed camera looking down or from the side.

## Starting point

\`index.html\` loads \`report.js\`, \`style.css\`, an import map for \`three\` and
\`three/addons/\` (three.js r186 from jsDelivr), the \`#game\` and \`#hud\` elements,
and \`main.js\`. \`report.js\` reports the game's errors to the app around the
preview; leave it unchanged and keep it as the first script in \`<head>\`.
\`main.js\` and the \`.welcome\` block in \`index.html\` are the placeholder welcome
scene: replace both with the game, keep \`report.js\`, the import map, \`#game\`
and \`#hud\`.
Add new import-map entries for other libraries the same way.

A game's \`main.js\` usually looks like this:

\`\`\`js
import * as THREE from "three"
import { Engine, overlaps } from "./engine/engine.js"
import { Hud } from "./engine/hud.js"
import { KEYS, FollowCamera } from "./engine/controls.js"
import * as models from "./engine/models.js"
import { Sound } from "./engine/audio.js"
import { Particles } from "./engine/particles.js"
import { Physics } from "./engine/physics.js"

const engine = new Engine()
const hud = new Hud()
const sound = new Sound()
engine.add(models.ground())
const player = engine.add(models.character())
const camera = new FollowCamera(engine.camera, player)

engine.onUpdate((dt, time) => {
  const move = engine.input.moveRelativeTo(engine.camera)
  player.position.addScaledVector(move, 6 * dt)
  camera.update(dt)
})

engine.start()
engine.paused = true
camera.snap()
await hud.screen({ title: "My game", body: "WASD to move", button: "Play" })
engine.paused = false
\`\`\`

## Modules

### engine/engine.js
- \`new Engine({ background, fog, shadows, fov })\`: renderer, scene, camera,
  \`hemisphere\` and \`sun\` lights with shadows, \`input\`, resize handling.
  \`background: null\` makes the canvas transparent over the page.
- \`start()\`, \`stop()\`, \`paused\` (stops game time, timers and updates; still
  renders), \`time\` (seconds of unpaused play).
- \`onUpdate((dt, time) => …, { always })\`: per-frame logic, run in the order
  added; returns an unsubscribe function. \`always: true\` runs while paused too.
- \`add(object, (object, dt, time) => …)\` adds to the scene with an optional
  per-object update; \`remove(object)\` takes both away. Returns the object.
- \`after(seconds, fn)\`, \`every(seconds, fn)\`: game-time timers, both return a
  cancel function. \`tween(target, { y: 2 }, seconds, { easing, delay })\`
  animates numeric properties and returns a promise.
- \`pick(objects)\`: the nearest hit under the pointer, or null.
- \`focusShadows(position)\`: shadows cover 30 units around this point, so call
  it each frame with the player's position in larger worlds.
- \`useEnvironment(intensity)\`: studio reflections for shiny materials.
- \`overlaps(a, b, distance)\`: world-position distance check for pickups and hits.

### engine/controls.js
- \`engine.input\`: \`isDown(KEYS.jump)\` while held, \`wasPressed(...)\` on the
  press frame only, \`axis(neg, pos)\`, \`move()\` (WASD/arrows as x right and y
  forward), \`moveRelativeTo(camera)\` (a ground-plane Vector3 for third-person
  movement), \`pointer.position\` (NDC), \`pointer.down\`, \`pointer.clicked\`.
- \`KEYS\`: \`left right forward back jump action pause\` as key-code lists.
- Camera rigs, pick one: \`new FollowCamera(camera, target, { offset, look,
  stiffness, rotate })\` with \`update(dt)\` and \`snap()\`; \`orbitControls(engine,
  options)\` for board, puzzle and builder games; \`firstPerson(engine, { speed,
  height })\` locks the pointer on click (show a "click to play" prompt while
  \`controls.isLocked\` is false, and \`hud.crosshair()\`).

### engine/models.js
Low-poly models from primitives. Every origin is the centre of the model's base
(place at y = 0 to stand on the ground) and models face +z, so
\`model.rotation.y = Math.atan2(dir.x, dir.z)\` faces a direction. Geometries and
materials are shared: never dispose them.
- \`palette\`: named colors. \`material(color, { roughness, metalness, emissive,
  flat })\`: a shared material; any \`color\` option also accepts one.
- Primitives: \`box\`, \`sphere\`, \`cylinder\`, \`cone\`, \`capsule\`, \`torus\`,
  \`ground\`.
- Models: \`character\` (capsule with eyes, any color: players, enemies, NPCs),
  \`tree\`, \`rock\`, \`crate\`, \`coin\`, \`gem\`, \`flag\`, \`label(text)\` (a text
  sprite).
- \`scatter(factory, count, { area, clear, ...factoryOptions })\`: a Group of
  randomly placed, turned and sized copies, keeping a clear radius at the centre.

### engine/physics.js
Axis-aligned box physics for platformers, mazes and arenas:
\`new Physics({ gravity, floor })\`, \`addSolid(object)\` (\`refresh(object)\` after
moving it), \`addBody(object, { width, height, depth, gravity })\` returning
\`{ velocity, onGround }\`, \`touching(body)\`, and \`step(dt)\` once per frame after
setting velocities. Use \`overlaps()\` for pickups and triggers, not physics.

### engine/hud.js
\`new Hud()\`: \`set(id, value, label)\` for score, lives or level; \`bar(id, 0..1,
{ label, color })\`; \`remove(id)\`; \`toast(text)\`; \`crosshair(visible)\`;
\`screen({ title, body, button })\`, which resolves when the player presses the
button, Enter or Space, for title, pause and game-over screens; \`hideScreen()\`.

### engine/audio.js
\`new Sound()\`: synthesized effects with no files: \`play(name)\` with \`coin\`,
\`jump\`, \`shoot\`, \`hit\`, \`explosion\`, \`powerup\`, \`click\`, \`win\` or \`lose\`;
\`tone({ frequency, to, duration, type, volume, delay })\` and \`noise({ duration,
filter, filterTo })\` for custom effects; \`music(["C4", "E4", null, …], { bpm })\`
loops a melody and returns a stop function; \`load(name, url)\` for audio files;
\`muted\` and \`toggleMute()\`, remembered between visits. Sound starts after the
player's first key press or click, so a title screen with a button is the
natural place to begin.

### engine/particles.js
\`new Particles(engine)\`, then \`burst(position, { count, color, speed, size,
life, gravity, upward })\` for pickups, hits, explosions and dust.

### engine/utils.js
\`rand\`, \`randInt\`, \`pick\`, \`chance\`, \`shuffle\`, \`seeded(seed)\` (repeatable
random numbers), \`clamp\`, \`lerp\`, \`damp\`, \`ease\` curves for tweens,
\`store.get/set\` (saved JSON) and \`highScore(score)\` (saves and returns the best).

## Making it feel like a game

- Give every game a title screen with its controls, a goal, a way to lose or
  win, a game-over screen with the score and best score, and a restart.
- Reward actions: a sound, a particle burst or a small tween on every pickup,
  hit and jump. Show score and lives in the HUD.
- Use \`engine.paused\` for menus and game over; P or Escape to pause in action
  games. Offer M to mute.
- Keep motion frame-rate independent: scale every movement by \`dt\`.
- Reuse models and remove objects with \`engine.remove()\` when they are done.
`.trim()
