// Aurora Run — world.js
// Procedural terrain, sky, sun, drifting clouds, the lit runway and the
// glowing mission rings. Everything here is generated from a seeded
// value-noise heightmap, so the same seed always builds the same valley.

import { CONFIG } from './config.js';

const T = THREE;

// ---------------------------------------------------------------------------
// Seeded random + value noise (deterministic, no Math.random in the world)
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise with fractal octaves.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i]; base[i] = base[j]; base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  function lattice(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }
  function noise2(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const a = lattice(ix, iz), b = lattice(ix + 1, iz);
    const c = lattice(ix, iz + 1), d = lattice(ix + 1, iz + 1);
    const u = fade(fx), v = fade(fz);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  return function fbm(x, z, octaves = 4) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise2(x * freq, z * freq);
      norm += amp; amp *= 0.5; freq *= 2.1;
    }
    return sum / norm; // 0..1
  };
}

// ---------------------------------------------------------------------------
// Terrain height — shared by the mesh, the flight model and the missions.
// ---------------------------------------------------------------------------

const noise = makeNoise(1337);
const HALF = CONFIG.worldSize / 2;

function ridge(x, z) {
  // Distance from the valley floor that the runway sits in.
  const dx = x / 900, dz = (z - 300) / 1100;
  const valley = Math.exp(-(dx * dx + dz * dz) * 2.2);
  const n = noise(x * 0.0009 + 7.3, z * 0.0009 + 2.1, 4);
  const peaks = Math.pow(n, 1.6);
  return (1 - valley) * peaks * CONFIG.maxTerrainHeight + valley * n * 12;
}

export function getTerrainHeight(x, z) {
  const cx = Math.max(-HALF, Math.min(HALF, x));
  const cz = Math.max(-HALF, Math.min(HALF, z));
  const h = ridge(cx, cz);
  // Carve the lake flat in the north-east basin.
  const lakeDx = (cx - 1250) / 520, lakeDz = (cz + 1150) / 420;
  const lake = Math.exp(-(lakeDx * lakeDx + lakeDz * lakeDz));
  let out = h * (1 - lake) + CONFIG.seaLevel * lake;
  // Flatten an apron around the runway so the strip sits on level ground.
  const rw = CONFIG.runway;
  const mx = Math.max(0, Math.abs(cx - rw.x) - (rw.width / 2 + 70));
  const mz = Math.max(0, Math.abs(cz - rw.z) - (rw.length / 2 + 90));
  const d = Math.hypot(mx, mz);
  const flat = Math.max(0, 1 - d / 130);
  out = out * (1 - flat) + 1.2 * flat;
  return out;
}

// ---------------------------------------------------------------------------
// Materials / helpers
// ---------------------------------------------------------------------------

function terrainColor(height, slope, out) {
  // Green valley grass -> rock -> snow peaks, with a sandy shore at the lake.
  if (height < 3.5) { out.setRGB(0.76, 0.70, 0.45); return out; }      // shore sand
  if (height < 90) {
    const t = height / 90;
    out.setRGB(0.23 + 0.10 * t, 0.48 - 0.10 * t, 0.20); return out;    // grass
  }
  if (height < 170 || slope > 0.55) {
    out.setRGB(0.42, 0.38, 0.34); return out;                          // rock
  }
  const t = Math.min(1, (height - 170) / 60);
  out.setRGB(0.42 + 0.55 * t, 0.38 + 0.56 * t, 0.34 + 0.60 * t);       // snow
  return out;
}

function makeGlowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.55, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ---------------------------------------------------------------------------
// buildWorld(scene) — returns handles the game loop needs.
// ---------------------------------------------------------------------------

export function buildWorld(scene) {
  scene.fog = new T.Fog(0xbfd9ee, CONFIG.fogNear, CONFIG.fogFar);

  // --- Sky: big gradient dome + sun + horizon glow -------------------------
  const skyGeo = new T.SphereGeometry(5200, 24, 16);
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new T.Color(0x2f6fc4) },
      mid: { value: new T.Color(0x8ec3ee) },
      low: { value: new T.Color(0xf6d9a8) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h))
                          : mix(low, mid, smoothstep(-0.08, 0.12, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new T.Mesh(skyGeo, skyMat));

  // Sun: bright disc + halo sprite, low over the western peaks.
  const sunPos = new T.Vector3(-2600, 900, -1800);
  const sunTex = makeGlowTexture('rgba(255,246,200,1)', 'rgba(255,190,90,0.55)');
  const sun = new T.Sprite(new T.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
  sun.position.copy(sunPos);
  sun.scale.set(620, 620, 1);
  scene.add(sun);
  const sunLight = new T.DirectionalLight(0xfff2cf, 1.15);
  sunLight.position.copy(sunPos).normalize().multiplyScalar(1000);
  scene.add(sunLight);
  scene.add(new T.HemisphereLight(0xbfd9ff, 0x3d5a34, 0.75));

  // --- Terrain --------------------------------------------------------------
  const size = CONFIG.worldSize;
  const seg = CONFIG.terrainSegments;
  const geo = new T.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = getTerrainHeight(x, z);
    pos.setY(i, h);
    // Slope from neighbours, for the rock/snow switch.
    const s = Math.abs(getTerrainHeight(x + 24, z) - h) / 24
            + Math.abs(getTerrainHeight(x, z + 24) - h) / 24;
    terrainColor(h, s, col);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true }));
  terrain.receiveShadow = false;
  scene.add(terrain);

  // Lake surface (north-east basin).
  const lake = new T.Mesh(
    new T.CircleGeometry(560, 40),
    new T.MeshPhongMaterial({ color: 0x2f7fc4, shininess: 120, specular: 0x99ccff, transparent: true, opacity: 0.88 })
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(1250, CONFIG.seaLevel + 1.5, -1150);
  lake.scale.set(1, 0.75, 1);
  scene.add(lake);

  // --- Clouds: drifting puffs of flattened white spheres -------------------
  const cloudMat = new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const clouds = [];
  const cloudRand = mulberry32(4242);
  for (let i = 0; i < 26; i++) {
    const group = new T.Group();
    const puffs = 3 + Math.floor(cloudRand() * 4);
    for (let p = 0; p < puffs; p++) {
      const s = new T.Mesh(new T.SphereGeometry(28 + cloudRand() * 34, 10, 8), cloudMat);
      s.position.set((cloudRand() - 0.5) * 150, (cloudRand() - 0.5) * 18, (cloudRand() - 0.5) * 70);
      s.scale.y = 0.42;
      group.add(s);
    }
    group.position.set((cloudRand() - 0.5) * 3800, 420 + cloudRand() * 260, (cloudRand() - 0.5) * 3800);
    group.userData.speed = 3 + cloudRand() * 5;
    scene.add(group);
    clouds.push(group);
  }

  // --- Runway: asphalt strip, centreline dashes, edge + approach lights ---
  const rw = CONFIG.runway;
  const runwayGroup = new T.Group();
  const asphalt = new T.Mesh(
    new T.PlaneGeometry(rw.width, rw.length),
    new T.MeshLambertMaterial({ color: 0x2b2e33 })
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(rw.x, 2.2, rw.z);
  runwayGroup.add(asphalt);

  const dashMat = new T.MeshBasicMaterial({ color: 0xf5f5e8 });
  for (let d = -rw.length / 2 + 30; d < rw.length / 2 - 20; d += 46) {
    const dash = new T.Mesh(new T.PlaneGeometry(2.4, 22), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(rw.x, 2.35, rw.z + d);
    runwayGroup.add(dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new T.Mesh(new T.PlaneGeometry(5, 14), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(rw.x + k * 8, 2.35, rw.z + end * (rw.length / 2 - 18));
      runwayGroup.add(bar);
    }
  }
  // Edge lights: warm amber studs down both sides.
  const edgeGeo = new T.SphereGeometry(0.6, 8, 6);
  const edgeMat = new T.MeshBasicMaterial({ color: 0xffb347 });
  for (let d = -rw.length / 2; d <= rw.length / 2; d += 42) {
    for (const side of [-1, 1]) {
      const lamp = new T.Mesh(edgeGeo, edgeMat);
      lamp.position.set(rw.x + side * (rw.width / 2 + 3), 2.9, rw.z + d);
      runwayGroup.add(lamp);
    }
  }
  // Approach lights: a line of white strobes stretching south of the runway.
  const strobeMat = new T.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 1; i <= 6; i++) {
    const strobe = new T.Mesh(new T.BoxGeometry(2.5, 1.2, 2.5), strobeMat);
    strobe.position.set(rw.x, 3.2, rw.z - rw.length / 2 - i * 55);
    strobe.userData.strobe = true;
    runwayGroup.add(strobe);
  }
  scene.add(runwayGroup);

  // Flatten the terrain under the runway so the strip sits on level ground.
  // (The valley function already keeps this area low; the strip floats 2.2m
  // above the valley floor, which reads as a raised airfield apron.)

  return {
    clouds,
    runwayGroup,
    sunSprite: sun,
    update(dt, time) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > HALF + 300) c.position.x = -HALF - 300;
      }
      // Strobe blink.
      const on = Math.sin(time * 6) > 0.2;
      runwayGroup.children.forEach((child) => {
        if (child.userData.strobe) child.visible = on;
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Rings — glowing torus gates the player flies through.
// ---------------------------------------------------------------------------

export function createRing(colorHex, radius = CONFIG.rings.radius) {
  const group = new T.Group();
  const torus = new T.Mesh(
    new T.TorusGeometry(radius, 1.6, 12, 48),
    new T.MeshBasicMaterial({ color: colorHex })
  );
  group.add(torus);
  const glowTex = makeGlowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
  const halo = new T.Sprite(new T.SpriteMaterial({
    map: glowTex, color: colorHex, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  halo.scale.set(radius * 3.4, radius * 3.4, 1);
  group.add(halo);
  group.userData.halo = halo;
  group.userData.torus = torus;
  return group;
}

// Ring course: a sweeping loop out over the valley, past the lake, back home.
export function ringCourse() {
  const pts = [
    [0, 170, -260],
    [-420, 200, -700],
    [-760, 230, -300],
    [-620, 210, 320],
    [-180, 190, 760],
    [420, 220, 900],
    [900, 240, 420],
    [760, 200, -180],
  ];
  return pts.slice(0, CONFIG.rings.count).map(([x, y, z]) => new THREE.Vector3(x, y, z));
}

// The green fuel ring hovers low over the lake, off the main course.
export function fuelRingPosition() {
  return new THREE.Vector3(1250, 120, -1150);
}
