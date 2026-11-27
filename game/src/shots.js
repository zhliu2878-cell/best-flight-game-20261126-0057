// Aurora Run — shots.js
// Deterministic staging for screenshots: ?shot=start|play|end&seed=1 poses
// the scene so each capture is composed and repeatable. With no query
// params the game plays normally and this module does nothing.

import { CONFIG } from './config.js';

const T = THREE;

export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot || !['start', 'play', 'end'].includes(shot)) return null;
  const seed = parseInt(q.get('seed') || '1', 10) || 1;
  return { shot, seed };
}

// Pose the flight model + camera for the requested shot. Returns an object
// describing what the HUD/overlay should show for this shot.
export function poseShot(shot, flight, mission, camera) {
  const rw = CONFIG.runway;
  if (shot === 'start') {
    // Title screen: parked on the runway at dawn, valley + peaks ahead.
    flight.position.set(rw.x, 4, rw.z + 180);
    flight.heading = Math.PI;      // facing south, down the runway
    flight.pitch = 0; flight.roll = 0;
    flight.speed = 0; flight.throttle = 0;
    flight.fuel = 100; flight.damage = 0;
    // Camera off to the side so the parked plane sits left of the title card.
    camera.position.set(30, 9, rw.z + 216);
    camera.lookAt(-10, 26, rw.z - 400);
    return { overlay: 'title', hud: false };
  }
  if (shot === 'play') {
    // Mid-flight chase: closing on ring 1 over the green valley, the next
    // gate big in frame with the runway valley behind it.
    // Ring 1 sits at (0, 170, -260); approach it from the south-east.
    flight.position.set(42, 168, -118);
    flight.heading = 0.19;        // toward ring 1
    flight.pitch = 0.05; flight.roll = -0.2;
    flight.speed = CONFIG.plane.cruiseSpeed * CONFIG.shots.playSpeed;
    flight.throttle = 0.72;
    flight.fuel = 82; flight.damage = 0;
    mission.nextRing = 0;
    mission.score = 0;
    mission.elapsed = 18;
    mission.updateRingHighlights();
    // Tight chase camera so the aircraft fills the lower frame.
    const back = new T.Vector3(Math.sin(flight.heading), 0, Math.cos(flight.heading));
    camera.position.copy(flight.position).addScaledVector(back, 15);
    camera.position.y += 4.5;
    camera.lookAt(0, 170, -260);
    return { overlay: null, hud: true };
  }
  // 'end' — final approach: low over the strobes, runway filling the frame.
  // The fuel ring hangs over the lake far to the north-east; the rings the
  // player already cleared are hidden so the runway owns the frame.
  flight.position.set(6, 118, rw.z - rw.length / 2 - 420);
  flight.heading = Math.PI;        // flying south (+Z) onto the runway
  flight.pitch = -0.06; flight.roll = 0.02;
  flight.speed = 38;
  flight.throttle = 0.38;
  flight.fuel = 34; flight.damage = 0;
  mission.rings.forEach((ring) => { ring.visible = false; });
  mission.fuelRing.visible = false;
  mission.nextRing = mission.rings.length;
  mission.phase = 'land';
  mission.score = 2000;
  mission.elapsed = 372;
  mission.updateRingHighlights();
  const back = new T.Vector3(Math.sin(flight.heading), 0, Math.cos(flight.heading));
  camera.position.copy(flight.position).addScaledVector(back, 18);
  camera.position.y += 5;
  camera.lookAt(rw.x, 6, rw.z);
  return { overlay: null, hud: true };
}
