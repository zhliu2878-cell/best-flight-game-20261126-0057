// Aurora Run — missions.js
// The mission: Ring Run — fly through 8 glowing rings in order, refuel at
// the green fuel ring if you run low, then land on the runway to finish.
// Scores rings, landing quality and time; tracks damage and game over.

import { CONFIG, MISSION_TEXT } from './config.js';
import { createRing, ringCourse, fuelRingPosition } from './world.js';

const T = THREE;

const RING_GOLD = 0xffc93c;
const RING_NEXT = 0xffe98a;
const RING_DONE = 0x3ddc84;
const FUEL_GREEN = 0x2ee66b;

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    this.fuelRing = null;
    this.reset();
  }

  reset() {
    // Clear old rings.
    for (const r of this.rings) this.scene.remove(r);
    if (this.fuelRing) this.scene.remove(this.fuelRing);

    this.ringPositions = ringCourse();
    this.rings = this.ringPositions.map((pos) => {
      const ring = createRing(RING_GOLD);
      ring.position.copy(pos);
      this.scene.add(ring);
      return ring;
    });
    this.fuelRing = createRing(FUEL_GREEN, 30);
    this.fuelRing.position.copy(fuelRingPosition());
    this.scene.add(this.fuelRing);

    this.nextRing = 0;
    this.score = 0;
    this.elapsed = 0;
    this.phase = 'rings';       // 'rings' | 'land' | 'done' | 'crashed'
    this.fuelWarned = false;
    this.fuelRefilled = false;
    this.landingScore = 0;
    this.events = [];           // drained by main.js for sounds + toasts
    this.updateRingHighlights();
  }

  updateRingHighlights() {
    this.rings.forEach((ring, i) => {
      const done = i < this.nextRing;
      const isNext = i === this.nextRing && this.phase === 'rings';
      const color = done ? RING_DONE : isNext ? RING_NEXT : RING_GOLD;
      ring.userData.torus.material.color.setHex(color);
      ring.userData.halo.material.color.setHex(color);
      ring.userData.halo.material.opacity = isNext ? 0.85 : 0.45;
    });
  }

  // Where the HUD arrow / mission text should point the player.
  currentTarget() {
    if (this.phase === 'rings') return this.ringPositions[this.nextRing];
    if (this.phase === 'land') {
      return new T.Vector3(CONFIG.runway.x, 40, CONFIG.runway.z - CONFIG.runway.length / 2);
    }
    return null;
  }

  missionText() {
    if (this.phase === 'rings') return MISSION_TEXT.rings(this.nextRing, this.rings.length);
    if (this.phase === 'land') return MISSION_TEXT.land;
    if (this.phase === 'done') return MISSION_TEXT.landed;
    return MISSION_TEXT.crashed;
  }

  missionSub() {
    if (this.phase === 'rings') return 'Next ring glows brightest — fly through its centre.';
    if (this.phase === 'land') return 'Slow below 80 kt, sink gently, stay on the centreline.';
    if (this.phase === 'done') return `Final score ${this.score} — press R to fly again.`;
    return 'Press R to fly again.';
  }

  update(dt, flight) {
    if (this.phase === 'done' || this.phase === 'crashed') return;
    this.elapsed += dt;

    // --- Ring passes -------------------------------------------------------
    if (this.phase === 'rings') {
      const target = this.ringPositions[this.nextRing];
      const d = flight.position.distanceTo(target);
      if (d < CONFIG.rings.passRadius) {
        this.score += CONFIG.rings.scorePerRing;
        this.nextRing++;
        this.events.push({ type: 'ring', index: this.nextRing });
        if (this.nextRing >= this.rings.length) {
          this.phase = 'land';
          this.events.push({ type: 'all-rings' });
        }
        this.updateRingHighlights();
      }
    }

    // --- Fuel ring: refuel any time, once per pass --------------------------
    const fd = flight.position.distanceTo(this.fuelRing.position);
    if (fd < 26 && flight.fuel < 95) {
      flight.fuel = 100;
      this.fuelRefilled = true;
      this.events.push({ type: 'fuel' });
    }

    // --- Fuel warning -------------------------------------------------------
    if (flight.fuel < 25 && !this.fuelWarned) {
      this.fuelWarned = true;
      this.events.push({ type: 'low-fuel' });
    }
    if (flight.fuel > 40) this.fuelWarned = false;

    // --- Landing / crash ----------------------------------------------------
    if (flight.landed && this.phase === 'land') {
      const quality = this.landingQuality(flight);
      this.landingScore = Math.round(CONFIG.landing.scoreBase + quality * CONFIG.landing.scorePerQuality);
      const timeBonus = Math.max(0, Math.round((600 - this.elapsed) * CONFIG.rings.timeBonusPerSecond));
      this.score += this.landingScore + timeBonus;
      this.phase = 'done';
      this.events.push({ type: 'landed', landingScore: this.landingScore, timeBonus });
    } else if (flight.landed && this.phase === 'rings') {
      // Touched down early: bounce back up, no score, keep the rings.
      this.events.push({ type: 'early-touchdown' });
      flight.landed = false;
      flight.position.y += 30;
      flight.speed = Math.max(flight.speed, 45);
    }
    if (flight.crashed) {
      this.phase = 'crashed';
      this.events.push({ type: 'crashed' });
    }
    if (flight.damage >= 100 && !flight.crashed) {
      flight.crashed = true;
      this.phase = 'crashed';
      this.events.push({ type: 'crashed' });
    }
  }

  // 0..1: how clean the touchdown was (speed, sink rate, centreline).
  landingQuality(flight) {
    const rw = CONFIG.runway;
    const speedQ = Math.max(0, 1 - flight.speed / CONFIG.landing.maxSpeed);
    const sinkQ = Math.max(0, 1 - Math.max(0, -flight.verticalSpeed) / CONFIG.landing.maxSink);
    const offsetQ = Math.max(0, 1 - Math.abs(flight.position.x - rw.x) / CONFIG.landing.maxOffset);
    return (speedQ + sinkQ + offsetQ) / 3;
  }

  // Pulse the next ring + spin the fuel ring slowly, for life.
  animate(time) {
    const pulse = 1 + Math.sin(time * 3.2) * 0.12;
    this.rings.forEach((ring, i) => {
      if (i === this.nextRing && this.phase === 'rings') ring.scale.setScalar(pulse);
      else ring.scale.setScalar(1);
    });
    if (this.fuelRing) {
      this.fuelRing.rotation.z += 0.003;
      const fp = 1 + Math.sin(time * 2.1) * 0.08;
      this.fuelRing.scale.setScalar(fp);
    }
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }
}
