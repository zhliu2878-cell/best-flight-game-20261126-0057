// Aurora Run — plane.js
// The aircraft: built from three.js primitives (fuselage, wings, tail,
// spinning propeller) plus the flight model — pitch, roll, yaw, throttle,
// lift and stall. No imported model, no copied mesh.

import { CONFIG } from './config.js';
import { getTerrainHeight } from './world.js';

const T = THREE;

// Aurora paint scheme: dawn-orange fuselage, cream wings, teal tail.
const PAINT = {
  fuselage: 0xe8622a,
  wing: 0xf3ead8,
  tail: 0x1f7a8c,
  glass: 0x9fd8ef,
  prop: 0x22242a,
};

export function buildPlaneMesh() {
  const group = new T.Group();

  const fuselageMat = new T.MeshPhongMaterial({ color: PAINT.fuselage, shininess: 60 });
  const wingMat = new T.MeshPhongMaterial({ color: PAINT.wing, shininess: 40 });
  const tailMat = new T.MeshPhongMaterial({ color: PAINT.tail, shininess: 50 });
  const glassMat = new T.MeshPhongMaterial({ color: PAINT.glass, shininess: 140, specular: 0xffffff });
  const darkMat = new T.MeshPhongMaterial({ color: PAINT.prop, shininess: 20 });

  // Fuselage: a tapered cylinder pointing forward (-Z is forward here).
  const body = new T.Mesh(new T.CylinderGeometry(0.55, 0.85, 5.6, 14), fuselageMat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Nose cone + spinner.
  const nose = new T.Mesh(new T.ConeGeometry(0.55, 1.4, 14), fuselageMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  group.add(nose);
  const spinner = new T.Mesh(new T.ConeGeometry(0.28, 0.7, 10), darkMat);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -4.2;
  group.add(spinner);

  // Canopy: a flattened half-sphere of glass over the cockpit.
  const canopy = new T.Mesh(new T.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  canopy.scale.set(1, 0.75, 1.9);
  canopy.position.set(0, 0.42, -0.6);
  group.add(canopy);

  // Main wing: wide, slightly swept, with rounded tips.
  const wing = new T.Mesh(new T.BoxGeometry(11.5, 0.22, 1.9), wingMat);
  wing.position.set(0, -0.15, 0.4);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new T.Mesh(new T.SphereGeometry(0.55, 10, 8), tailMat);
    tip.scale.set(0.5, 0.25, 1.7);
    tip.position.set(side * 5.75, -0.15, 0.4);
    group.add(tip);
    // Navigation lights: red port, green starboard.
    const nav = new T.Mesh(
      new T.SphereGeometry(0.16, 8, 6),
      new T.MeshBasicMaterial({ color: side < 0 ? 0xff2a2a : 0x2aff5a })
    );
    nav.position.set(side * 6.1, -0.1, 0.4);
    group.add(nav);
  }

  // Tail: horizontal stabiliser + vertical fin.
  const stab = new T.Mesh(new T.BoxGeometry(3.6, 0.16, 1.1), tailMat);
  stab.position.set(0, 0.15, 2.5);
  group.add(stab);
  const fin = new T.Mesh(new T.BoxGeometry(0.16, 1.5, 1.4), tailMat);
  fin.position.set(0, 0.75, 2.5);
  fin.rotation.x = -0.25;
  group.add(fin);

  // Propeller: two blades on a hub, spun by the flight model.
  const prop = new T.Group();
  const hub = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.3, 10), darkMat);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  for (const a of [0, Math.PI / 2]) {
    const blade = new T.Mesh(new T.BoxGeometry(0.24, 2.7, 0.08), darkMat);
    blade.rotation.z = a;
    prop.add(blade);
  }
  // Translucent blur disc: reads as a spinning propeller from any angle.
  const disc = new T.Mesh(
    new T.CircleGeometry(1.45, 24),
    new T.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.16, side: T.DoubleSide })
  );
  prop.add(disc);
  prop.position.z = -4.35;
  group.add(prop);
  group.userData.propeller = prop;

  // Landing gear: two fixed wheels + a tail wheel.
  for (const side of [-1, 1]) {
    const strut = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.9, 8), darkMat);
    strut.position.set(side * 0.9, -0.9, 0.2);
    group.add(strut);
    const wheel = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.24, 12), darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.9, -1.3, 0.2);
    group.add(wheel);
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

// ---------------------------------------------------------------------------
// Flight model — state + step(dt, input)
// ---------------------------------------------------------------------------

export class FlightModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.position = new T.Vector3(0, 150, 900);
    this.heading = 0;            // facing north (-Z), toward the first ring
    this.pitch = 0;              // radians, + = nose up
    this.roll = 0;               // radians, + = bank right
    this.speed = 40;             // m/s
    this.throttle = 0.55;
    this.fuel = CONFIG.plane.startFuel;
    this.damage = 0;
    this.verticalSpeed = 0;
    this.propAngle = 0;
    this.crashed = false;
    this.landed = false;
  }

  // True airspeed the engine is pushing toward at this throttle.
  targetSpeed() {
    const p = CONFIG.plane;
    return p.minSpeed + (p.cruiseSpeed - p.minSpeed) * this.throttle * 1.15;
  }

  step(dt, input) {
    if (this.crashed || this.landed) return;
    const p = CONFIG.plane;

    // Throttle keys.
    if (input.throttleUp) this.throttle = Math.min(1, this.throttle + p.throttleStep * dt);
    if (input.throttleDown) this.throttle = Math.max(0, this.throttle - p.throttleStep * dt);

    // Pitch / roll from stick (keyboard + mouse drag are merged in input.js).
    const pitchIn = input.pitch;   // -1..1, + = pull up
    const rollIn = input.roll;     // -1..1, + = bank right
    this.pitch += pitchIn * p.pitchRate * dt;
    this.pitch = Math.max(-0.6, Math.min(0.6, this.pitch));
    this.roll += rollIn * p.rollRate * dt;
    this.roll = Math.max(-1.1, Math.min(1.1, this.roll));
    // Gentle self-levelling when the stick is centred.
    if (Math.abs(rollIn) < 0.05) this.roll *= Math.max(0, 1 - 0.8 * dt);
    if (Math.abs(pitchIn) < 0.05) this.pitch *= Math.max(0, 1 - 0.5 * dt);

    // Coordinated turn: bank turns the heading.
    this.heading -= this.roll * p.turnRate * dt;

    // Speed chases the throttle target; climbing bleeds speed, diving gains it.
    const target = this.targetSpeed();
    const climbPenalty = Math.sin(this.pitch) * 18;
    this.speed += ((target - climbPenalty) - this.speed) * Math.min(1, 0.55 * dt);
    this.speed = Math.max(0, Math.min(p.maxSpeed, this.speed));

    // Stall: below min speed the wing stops lifting and the nose drops.
    const stalled = this.speed < p.minSpeed;
    if (stalled) this.pitch = Math.max(this.pitch - 0.35 * dt, -0.5);

    // Velocity from heading + pitch.
    const forward = new T.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const vy = Math.sin(this.pitch) * this.speed;
    const horizontal = Math.cos(this.pitch) * this.speed;
    this.verticalSpeed = vy;
    this.position.x += forward.x * horizontal * dt;
    this.position.z += forward.z * horizontal * dt;
    this.position.y += vy * dt;

    // Fuel burn follows throttle (fuelBurn is a fraction of the tank / s).
    this.fuel = Math.max(0, this.fuel - CONFIG.plane.fuelBurn * 100 * this.throttle * dt);
    if (this.fuel <= 0) this.throttle = Math.max(this.throttle, 0.12);

    // Stay inside the world.
    const half = CONFIG.worldSize / 2 - 60;
    this.position.x = Math.max(-half, Math.min(half, this.position.x));
    this.position.z = Math.max(-half, Math.min(half, this.position.z));
    this.position.y = Math.min(900, Math.max(2, this.position.y));

    // Ground contact.
    const ground = getTerrainHeight(this.position.x, this.position.z);
    if (this.position.y <= ground + 1.4) {
      this.position.y = ground + 1.4;
      this.touchGround();
    }

    this.propAngle += (4 + this.throttle * 46) * dt;
  }

  // Called when the wheels meet the ground. Returns 'landed' | 'crash' | 'bounce'.
  touchGround() {
    const p = CONFIG.plane;
    const rw = CONFIG.runway;
    const onRunway =
      Math.abs(this.position.x - rw.x) < rw.width / 2 + 6 &&
      Math.abs(this.position.z - rw.z) < rw.length / 2 + 6;
    const sink = -this.verticalSpeed;
    if (onRunway && this.speed < CONFIG.landing.maxSpeed && sink < CONFIG.landing.maxSink) {
      this.landed = true;
      this.speed *= 0.4;
      return 'landed';
    }
    if (sink > p.crashSpeed || this.speed > 70) {
      this.crashed = true;
      return 'crash';
    }
    // A survivable bounce off rough ground: damage, keep flying low.
    this.damage = Math.min(100, this.damage + p.damagePerHardHit);
    this.position.y += 6;
    this.speed *= 0.75;
    this.pitch = 0.12;
    if (this.damage >= 100) this.crashed = true;
    return 'bounce';
  }

  // Apply the model state to the visible mesh.
  applyToMesh(mesh) {
    mesh.position.copy(this.position);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = this.heading;
    mesh.rotation.x = -this.pitch;
    mesh.rotation.z = -this.roll;
    if (mesh.userData.propeller) {
      mesh.userData.propeller.rotation.z = this.propAngle;
    }
  }

  // Readouts for the HUD.
  altitudeFeet() { return Math.max(0, Math.round((this.position.y - getTerrainHeight(this.position.x, this.position.z)) * 3.28084)); }
  speedKnots() { return Math.round(this.speed * 1.94384); }
  headingDeg() { return Math.round(((this.heading * 180) / Math.PI % 360 + 360) % 360); }
}
