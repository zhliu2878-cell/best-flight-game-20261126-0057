// Aurora Run — input.js
// Keyboard + mouse steering, merged into one stick object the flight model
// reads each frame. Keys: W/S or Up/Down pitch, A/D or Left/Right roll and
// turn, Shift/Ctrl throttle, R restart, P pause. Dragging the mouse steers.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitch: 0,        // -1..1, + = pull up
    roll: 0,         // -1..1, + = bank right
    throttleUp: false,
    throttleDown: false,
    paused: false,
    restartRequested: false,
    mouseSteering: false,
  };

  let mousePitch = 0, mouseRoll = 0;
  let dragging = false;
  let lastX = 0, lastY = 0;

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (k === 'p' && !e.repeat) input.paused = !input.paused;
    if (k === 'r' && !e.repeat) input.restartRequested = true;
    keys.add(k);
    keys.add(e.key);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(keyName(e));
    keys.delete(e.key);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    input.mouseSteering = true;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    mousePitch = 0; mouseRoll = 0;
    input.mouseSteering = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    mouseRoll = Math.max(-1, Math.min(1, mouseRoll + dx * 0.012));
    mousePitch = Math.max(-1, Math.min(1, mousePitch - dy * 0.012));
  });

  // Recompute the merged stick every frame.
  input.update = function update() {
    let pitch = 0, roll = 0;
    if (keys.has('w') || keys.has('ArrowUp')) pitch += 1;
    if (keys.has('s') || keys.has('ArrowDown')) pitch -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) roll += 1;
    if (keys.has('a') || keys.has('ArrowLeft')) roll -= 1;
    if (dragging) {
      pitch += mousePitch;
      roll += mouseRoll;
    }
    input.pitch = Math.max(-1, Math.min(1, pitch));
    input.roll = Math.max(-1, Math.min(1, roll));
    input.throttleUp = keys.has('Shift');
    input.throttleDown = keys.has('Control');
  };

  input.consumeRestart = function consumeRestart() {
    const r = input.restartRequested;
    input.restartRequested = false;
    return r;
  };

  return input;
}
