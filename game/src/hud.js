// Aurora Run — hud.js
// The DOM instrument overlay: altitude, speed, heading compass, throttle,
// fuel, score, mission text, timer and damage. Lit-panel styling so the
// instruments read as flown hardware, not plain text.

export function buildHud() {
  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <div class="panel" id="panel-left">
      <div class="gauge"><span class="label">ALT</span><span class="value" id="hud-alt">0</span><span class="unit">FT</span></div>
      <div class="gauge"><span class="label">SPD</span><span class="value" id="hud-spd">0</span><span class="unit">KT</span></div>
      <div class="gauge"><span class="label">HDG</span><span class="value" id="hud-hdg">000°</span><span class="unit" id="hud-hdg-name">N</span></div>
      <div class="gauge"><span class="label">THR</span><span class="value" id="hud-thr">0%</span><span class="unit">PWR</span></div>
    </div>
    <div class="panel" id="panel-top">
      <div id="hud-mission">AURORA RUN</div>
      <div id="hud-sub">Fly through the rings, then land.</div>
    </div>
    <div class="panel" id="panel-right">
      <div class="gauge"><span class="label">SCORE</span><span class="value" id="hud-score">0</span></div>
      <div class="gauge"><span class="label">TIME</span><span class="value" id="hud-time">0:00</span></div>
      <div class="bar-row"><span class="label">FUEL</span><div class="bar"><div id="hud-fuel-fill"></div></div><span class="value small" id="hud-fuel">100%</span></div>
      <div class="bar-row"><span class="label">DMG</span><div class="bar"><div id="hud-dmg-fill"></div></div><span class="value small" id="hud-dmg">0%</span></div>
    </div>
    <div id="hud-toast"></div>
    <div id="hud-center">✦</div>
  `;
  document.body.appendChild(hud);

  // Title / game-over overlay, reused by the start shot and the end screens.
  const overlay = document.createElement('div');
  overlay.id = 'overlay';
  overlay.innerHTML = `
    <div id="overlay-card">
      <h1 id="overlay-title">AURORA RUN</h1>
      <p id="overlay-body">Dawn patrol over the valley. Fly the rings, mind the fuel, bring her home.</p>
      <p id="overlay-controls">W/S pitch &nbsp;·&nbsp; A/D roll &nbsp;·&nbsp; SHIFT / CTRL throttle &nbsp;·&nbsp; drag mouse to steer &nbsp;·&nbsp; R restart &nbsp;·&nbsp; P pause</p>
      <p id="overlay-hint">Click to fly</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const el = (id) => document.getElementById(id);
  const refs = {
    alt: el('hud-alt'), spd: el('hud-spd'), hdg: el('hud-hdg'), hdgName: el('hud-hdg-name'),
    thr: el('hud-thr'), score: el('hud-score'), time: el('hud-time'),
    fuelFill: el('hud-fuel-fill'), fuel: el('hud-fuel'),
    dmgFill: el('hud-dmg-fill'), dmg: el('hud-dmg'),
    mission: el('hud-mission'), sub: el('hud-sub'), toast: el('hud-toast'),
    overlay, overlayTitle: el('overlay-title'), overlayBody: el('overlay-body'),
    overlayHint: el('overlay-hint'),
  };

  let toastTimer = 0;
  function showToast(text, ms = 2600) {
    refs.toast.textContent = text;
    refs.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => refs.toast.classList.remove('show'), ms);
  }

  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  return {
    refs,
    showToast,
    showOverlay(title, body, hint) {
      refs.overlayTitle.textContent = title;
      refs.overlayBody.textContent = body;
      refs.overlayHint.textContent = hint || '';
      refs.overlay.classList.add('show');
    },
    hideOverlay() {
      refs.overlay.classList.remove('show');
    },
    overlayVisible() {
      return refs.overlay.classList.contains('show');
    },
    // Called every frame with the live flight + mission state.
    update(state) {
      refs.alt.textContent = state.altitudeFeet;
      refs.spd.textContent = state.speedKnots;
      const hdg = state.headingDeg;
      refs.hdg.textContent = String(hdg).padStart(3, '0') + '°';
      refs.hdgName.textContent = COMPASS[Math.round(hdg / 45) % 8];
      refs.thr.textContent = Math.round(state.throttle * 100) + '%';
      refs.score.textContent = state.score;
      const t = Math.floor(state.elapsed);
      refs.time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      refs.fuelFill.style.width = Math.max(0, state.fuel) + '%';
      refs.fuel.textContent = Math.round(state.fuel) + '%';
      refs.fuelFill.classList.toggle('low', state.fuel < 25);
      refs.dmgFill.style.width = Math.min(100, state.damage) + '%';
      refs.dmg.textContent = Math.round(state.damage) + '%';
      refs.mission.textContent = state.missionText;
      refs.sub.textContent = state.missionSub;
      document.getElementById('hud-center').style.opacity = state.showCenterMark ? '0.9' : '0';
    },
  };
}
