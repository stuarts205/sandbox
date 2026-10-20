// The 2D layer over the game: stat readouts, bars, toasts, a crosshair and
// full-screen menus. Built from DOM nodes in #hud rather than drawn in WebGL,
// so text stays crisp and its look lives in style.css. Colors are CSS colors.
export class Hud {
  constructor(root = document.getElementById("hud")) {
    this.root = root
    this.items = new Map()
    this.stats = element("div", "hud-stats", root)
    this.toasts = element("div", "hud-toasts", root)
    this.cross = element("div", "hud-crosshair", root)
    this.cross.hidden = true
    this.closeScreen = null
  }

  // A labelled value in the top-left corner (score, lives, level), created on
  // first use and updated on every call after.
  set(id, value, label = id) {
    let item = this.items.get(id)
    if (!item) {
      const node = element("div", "hud-stat", this.stats)
      item = {
        node,
        label: element("span", "hud-stat-label", node),
        value: element("span", "hud-stat-value", node),
      }
      this.items.set(id, item)
    }
    item.label.textContent = label
    item.value.textContent = String(value)
  }

  // A labelled bar filled to fraction (0..1), for health, fuel or a timer.
  bar(id, fraction, { label = id, color } = {}) {
    let item = this.items.get(id)
    if (!item) {
      const node = element("div", "hud-stat hud-bar", this.stats)
      const label = element("span", "hud-stat-label", node)
      const track = element("span", "hud-bar-track", node)
      item = { node, label, fill: element("span", "hud-bar-fill", track) }
      this.items.set(id, item)
    }
    item.label.textContent = label
    item.fill.style.width = `${Math.min(Math.max(fraction, 0), 1) * 100}%`
    if (color) item.node.style.setProperty("--bar-color", color)
  }

  remove(id) {
    this.items.get(id)?.node.remove()
    this.items.delete(id)
  }

  // A short message at the top of the screen that fades away by itself.
  toast(text, seconds = 1.6) {
    const node = element("div", "hud-toast", this.toasts)
    node.textContent = text
    node.style.animationDuration = `${seconds}s`
    setTimeout(() => node.remove(), seconds * 1000)
  }

  crosshair(visible = true) {
    this.cross.hidden = !visible
  }

  // A centred panel over the game for title, pause and game-over screens.
  // Resolves when the player presses the button, Enter or Space, or when
  // hideScreen() is called. Pass button: null for a panel with no button.
  screen({ title, body = "", button = "Play" } = {}) {
    this.hideScreen()
    const overlay = element("div", "hud-screen", this.root)
    const panel = element("div", "hud-panel", overlay)
    element("h1", "", panel).textContent = title
    if (body) element("p", "", panel).textContent = body
    const action = button === null ? null : element("button", "", panel)
    if (action) {
      action.type = "button"
      action.textContent = button
    }

    return new Promise((resolve) => {
      const onKey = (event) => {
        if (event.code !== "Enter" && event.code !== "Space") return
        event.preventDefault()
        close()
      }
      const close = () => {
        window.removeEventListener("keydown", onKey)
        action?.removeEventListener("click", close)
        overlay.remove()
        this.closeScreen = null
        resolve()
      }
      action?.addEventListener("click", close)
      window.addEventListener("keydown", onKey)
      this.closeScreen = close
    })
  }

  hideScreen() {
    this.closeScreen?.()
  }
}

function element(tag, className, parent) {
  const node = document.createElement(tag)
  if (className) node.className = className
  parent.append(node)
  return node
}
