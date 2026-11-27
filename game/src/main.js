// Aurora Run — main.js
// Bootstrap + game loop. Builds the renderer, scene, aircraft and HUD,
// steps the flight model and missions, chases the camera, and drains
// mission events into sounds and toasts.

import { CONFIG, MISSION_TEXT } from './config.js';
import { buildWorld, getTerrainHeight } from './world.js';
import { buildPlaneMesh, FlightModel } from './plane.js';
import { createInput } from './input.js';
import { buildHud } from './hud.js';
import { createAudio } from './audio.js';
import { MissionManager } from './missions.js';
import { readShotParams, poseShot } from './shots.js';

const T = THREE;

function init() {
  // --- Renderer / scene / camera -------------------------------------------
  const canvas = document.getElementById('game-canvas');
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
  } catch (err) {
    document.body.innerHTML = '<div style="color:#fff;font:16px sans-serif;padding:40px">' +
      'Aurora Run needs WebGL to fly. Please open this page in a browser with WebGL enabled.</div>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(
    CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.5, 9000
  );

  const world = buildWorld(scene);

  // --- Aircraft -------------------------------------------------------------
  const planeMesh = buildPlaneMesh();
  scene.add(planeMesh);
  const flight = new FlightModel();

  // --- Missions, HUD, input, audio ------------------------------------------
  const mission = new MissionManager(scene);
  const hud = buildHud();
  const input = createInput(canvas);
  const audio = createAudio();

  let started = false;      // true once the player clicks past the title
  let shot = null;          // { shot, seed } when ?shot= is present
  let paused = false;
  let lastTime = performance.now();

  // Title overlay: click to fly (also unlocks audio).
  function beginFlight() {
    if (started) return;
    started = true;
    audio.startEngine();
    audio.resume();
    hud.hideOverlay();
    hud.showToast('Engines running — fly through the gold rings!');
  }
  hud.refs.overlay.addEventListener('click', beginFlight);
  window.addEventListener('keydown', (e) => {
    if (!started && (e.key === 'Enter' || e.key === ' ')) beginFlight();
  });

  // --- Screenshot staging ----------------------------------------------------
  shot = readShotParams();
  if (shot) {
    const pose = poseShot(shot.shot, flight, mission, camera);
    if (pose.overlay === 'title') {
      hud.showOverlay('AURORA RUN',
        'Dawn patrol over the valley. Fly the rings, mind the fuel, bring her home.',
        'Click to fly');
      document.getElementById('hud').style.display = 'none';
    } else {
      started = true;
      hud.hideOverlay();
      audio.startEngine();
    }
    // Freeze the staged pose: screenshots render one composed frame.
    flight.applyToMesh(planeMesh);
    renderer.render(scene, camera);
  } else {
    hud.showOverlay('AURORA RUN',
      'Dawn patrol over the valley. Fly the rings, mind the fuel, bring her home.',
      'Click to fly');
  }

  // --- Chase camera ----------------------------------------------------------
  const camPos = new T.Vector3();
  const camTarget = new T.Vector3();
  function updateCamera(dt) {
    if (shot) return; // staged shots keep their composed camera
    const back = new T.Vector3(Math.sin(flight.heading), 0, Math.cos(flight.heading));
    const fwd = new T.Vector3(-Math.sin(flight.heading), 0, -Math.cos(flight.heading));
    camPos.copy(flight.position).addScaledVector(back, CONFIG.camera.chaseDistance);
    camPos.y += CONFIG.camera.chaseHeight;
    const ground = getTerrainHeight(camPos.x, camPos.z);
    if (camPos.y < ground + 3) camPos.y = ground + 3;
    camera.position.lerp(camPos, Math.min(1, dt * 6));
    camTarget.copy(flight.position).addScaledVector(fwd, CONFIG.camera.lookAhead);
    camTarget.y += 1.5;
    camera.lookAt(camTarget);
  }

  // --- Mission events -> sounds + toasts --------------------------------------
  function handleEvents(events) {
    for (const ev of events) {
      if (ev.type === 'ring') {
        audio.ringChime();
        hud.showToast(`Ring ${ev.index} of ${mission.rings.length} — +${CONFIG.rings.scorePerRing}`);
      } else if (ev.type === 'all-rings') {
        hud.showToast('All rings clear! Land on the runway.');
      } else if (ev.type === 'fuel') {
        audio.fuelChime();
        hud.showToast('Fuel ring — tank refilled!');
      } else if (ev.type === 'low-fuel') {
        hud.showToast('LOW FUEL — find the green fuel ring!');
      } else if (ev.type === 'early-touchdown') {
        hud.showToast('Too early — back up, the rings are still out there.');
      } else if (ev.type === 'landed') {
        audio.landingThud();
        hud.showOverlay('MISSION COMPLETE',
          `Touchdown! Landing +${ev.landingScore}, time bonus +${ev.timeBonus}. Final score ${mission.score}.`,
          'Press R to fly again');
      } else if (ev.type === 'crashed') {
        audio.crashBurst();
        hud.showOverlay('CRASHED',
          `The Aurora is down. Score ${mission.score} — rings cleared ${mission.nextRing} of ${mission.rings.length}.`,
          'Press R to fly again');
      }
    }
  }

  // --- Restart ---------------------------------------------------------------
  function restart() {
    flight.reset();
    mission.reset();
    started = true;
    hud.hideOverlay();
    audio.resume();
  }

  // --- Resize ------------------------------------------------------------------
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Main loop ---------------------------------------------------------------
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const time = now / 1000;

    input.update();
    if (input.consumeRestart()) restart();
    if (input.paused !== paused) {
      paused = input.paused;
      hud.showToast(paused ? 'Paused — press P to resume' : 'Flying again');
    }

    if (!shot && started && !paused) {
      flight.step(dt, input);
      mission.update(dt, flight);
      handleEvents(mission.drainEvents());
      flight.applyToMesh(planeMesh);
      audio.update(flight.throttle, flight.speed, flight.position.y > getTerrainHeight(flight.position.x, flight.position.z) + 2);
    } else if (shot) {
      // Staged shot: keep the aircraft posed, animate the world lightly.
      flight.applyToMesh(planeMesh);
    }

    mission.animate(time);
    world.update(dt, time);
    updateCamera(dt);

    hud.update({
      altitudeFeet: flight.altitudeFeet(),
      speedKnots: flight.speedKnots(),
      headingDeg: flight.headingDeg(),
      throttle: flight.throttle,
      score: mission.score,
      elapsed: mission.elapsed,
      fuel: flight.fuel,
      damage: flight.damage,
      missionText: mission.missionText(),
      missionSub: mission.missionSub(),
      showCenterMark: started && !shot,
    });

    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}

init();
