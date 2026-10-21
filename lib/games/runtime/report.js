// Reports the game's health to the app around the preview. A plain script
// loaded ahead of main.js, so it is listening before any module runs and still
// works when main.js fails to parse or one of its imports fails to load.
//
// The app polls with { type: "game-ping" }; the frame answers
// { type: "game-status", error }, where error is the first one caught since the
// page loaded ({ message, source, line, column, stack }), or null while the
// game is healthy. Later errors are usually fallout from the first, so only the
// first is kept.
;(() => {
  let first = null

  // Script URLs relative to the game directory (main.js, engine/hud.js), since
  // the preview is served from a proxied URL the app has no use for.
  const base = new URL(".", location.href).href
  const relative = (url) => (url && url.startsWith(base) ? url.slice(base.length) : url || null)

  const record = (error) => {
    if (!first) {
      first = error
    }
  }

  const describe = (value) => {
    if (value instanceof Error) {
      return { message: `${value.name}: ${value.message}`, stack: value.stack || null }
    }
    return { message: String(value), stack: null }
  }

  // Runtime errors, syntax errors in classic and module scripts, and import map
  // errors arrive as ErrorEvents on window. A script that fails to load (a
  // missing main.js, a misspelled import or an unreachable CDN) fires a plain
  // error event on its <script> element instead, which doesn't bubble but does
  // pass window on the way down, hence the capture phase.
  window.addEventListener(
    "error",
    (event) => {
      if (event instanceof ErrorEvent) {
        const { message, stack } = event.error ? describe(event.error) : { message: event.message, stack: null }
        record({
          message,
          source: relative(event.filename),
          line: event.lineno || null,
          column: event.colno || null,
          stack,
        })
      } else if (event.target instanceof HTMLScriptElement) {
        record({
          // For a module this may be one of its imports rather than the file.
          message: "Script or one of its imports failed to load",
          source: relative(event.target.src) || "inline script",
          line: null,
          column: null,
          stack: null,
        })
      }
    },
    true
  )

  // Rejected promises nobody handled, including a top-level await in main.js
  // that throws.
  window.addEventListener("unhandledrejection", (event) => {
    record({ ...describe(event.reason), source: null, line: null, column: null })
  })

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "game-ping") {
      return
    }
    window.parent.postMessage({ type: "game-status", error: first }, event.origin)
  })
})()
