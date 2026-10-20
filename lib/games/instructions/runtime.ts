import { GAME_DIR, GAME_PORT } from "@/lib/daytona/utils"

// The environment the game runs in: its Daytona sandbox, the game directory,
// and the static server behind the preview.
export const runtime = `
# Runtime

Each game has its own Daytona sandbox, a Linux machine created on the game's first
message. The game lives in one directory in it:

    ${GAME_DIR}

- \`${GAME_DIR}/index.html\` is the entry point. A new game starts with a
  placeholder page there; replace it with the real game.
- The directory is served as static files by \`python3 -m http.server\` on port
  ${GAME_PORT}. The preview beside the chat loads \`index.html\` from that server.
- There is no build step and no bundler. Write plain HTML, CSS and JavaScript that
  a browser runs as is. Split code into ES modules with
  \`<script type="module">\` and relative imports when a single file grows large.
- Libraries load in the player's browser, so pull them from a CDN (for example
  with an import map pointing at esm.sh, jsDelivr or unpkg) rather than installing
  them with npm.
- Reference other files with relative paths (\`./game.js\`, \`./assets/sprite.png\`),
  never absolute ones, because the preview is served from a proxied URL.
- The sandbox stops when idle and restarts when the game is opened again. Files in
  the game directory persist across restarts; running processes do not, so the game
  must not depend on anything but its own files.
`.trim()
