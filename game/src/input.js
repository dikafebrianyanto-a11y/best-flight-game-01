// input.js — keyboard and mouse, one small class.
// The game reads axes, not raw keys: throttle, pitch and bank are
// -1..1 values, so keyboard, mouse steering and menus share one language.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseActive = false;
    this.mouseClicked = false;
    this.lastMouseMoveAt = 0;
    this.canvas = canvas;

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.key.toLowerCase());
      this.keys.add(event.key.toLowerCase());
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
      this.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
      this.mouseActive = true;
      this.lastMouseMoveAt = performance.now();
    });
    canvas.addEventListener('mousedown', () => {
      this.mouseClicked = true;
      this.mouseActive = true;
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouseActive = false;
    });
  }

  held(...names) {
    return names.some((name) => this.keys.has(name));
  }

  wasPressed(...names) {
    return names.some((name) => this.pressed.has(name));
  }

  // -1 (throttle down) .. 1 (throttle up).
  throttleAxis() {
    let value = 0;
    if (this.held('w', 'arrowup')) value += 1;
    if (this.held('s', 'arrowdown')) value -= 1;
    return value;
  }

  // -1 (pitch down) .. 1 (pitch up). Mouse steers when it moved recently
  // and no pitch key is held, so the mouse never fights the keyboard.
  pitchAxis(now) {
    if (this.held('a', 'arrowleft')) return 1;
    if (this.held('d', 'arrowright')) return -1;
    if (this.mouseActive && now - this.lastMouseMoveAt < 2500) {
      const centre = this.canvas.height * 0.42;
      const offset = (centre - this.mouseY) / 260;
      return Math.max(-1, Math.min(1, offset));
    }
    return 0;
  }

  // -1 (bank left) .. 1 (bank right).
  bankAxis() {
    let value = 0;
    if (this.held('q')) value -= 1;
    if (this.held('e')) value += 1;
    if (this.held('a', 'arrowleft')) value -= 1;
    if (this.held('d', 'arrowright')) value += 1;
    return Math.max(-1, Math.min(1, value));
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
