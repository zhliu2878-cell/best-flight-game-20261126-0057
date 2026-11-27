// Aurora Run — tuning constants.
// One place for every number the flight model, world and missions share,
// so the game can be balanced without hunting through the other files.

export const CONFIG = {
  // World
  worldSize: 4200,          // terrain plane side, metres
  terrainSegments: 180,     // heightmap resolution
  maxTerrainHeight: 260,    // tallest peak, metres
  seaLevel: 0,              // lake surface height
  fogNear: 400,
  fogFar: 3200,

  // Runway (lies along +Z, centred near the origin)
  runway: {
    x: 0,
    z: 300,
    headingDeg: 0,          // approach comes from the south (-Z side)
    length: 620,
    width: 46,
  },

  // Flight model
  plane: {
    minSpeed: 18,           // m/s — below this the wing stalls
    cruiseSpeed: 62,        // m/s at full throttle, level
    maxSpeed: 95,
    climbRate: 14,          // m/s at full throttle, nose up
    pitchRate: 0.85,        // rad/s at full stick
    rollRate: 1.9,          // rad/s at full stick
    turnRate: 0.55,         // rad/s of heading per rad of bank
    throttleStep: 0.5,      // per second while a throttle key is held
    fuelBurn: 0.004,        // fraction of the tank per second at full throttle
    fuelCapacity: 100,
    startFuel: 100,
    damagePerHardHit: 34,
    crashSpeed: 26,         // vertical speed (m/s) that counts as a crash
  },

  // Missions
  rings: {
    count: 8,
    radius: 26,             // ring opening radius, metres
    passRadius: 22,         // how close to the centre counts as a pass
    scorePerRing: 250,
    timeBonusPerSecond: 5,
  },
  landing: {
    scoreBase: 1000,
    maxSpeed: 42,           // m/s — faster than this is a hard landing
    maxSink: 6,             // m/s vertical speed allowed
    maxOffset: 26,          // metres from centreline
    scorePerQuality: 400,
  },

  // Camera
  camera: {
    chaseDistance: 16,
    chaseHeight: 5,
    lookAhead: 30,
    fov: 62,
  },

  // Shots (deterministic staging for screenshots)
  shots: {
    seed: 1,
    playAltitude: 210,
    playSpeed: 0.72,        // fraction of cruise speed
  },
};

// Mission text shown on the HUD, one line per phase.
export const MISSION_TEXT = {
  intro: 'AURORA RUN — fly through all 8 rings, then land on the runway.',
  rings: (done, total) => `RING RUN — fly through ring ${done + 1} of ${total}`,
  fuel: 'LOW FUEL — fly through the green fuel ring to refuel!',
  land: 'ALL RINGS CLEAR — land on the runway: slow, low, lined up.',
  landed: 'TOUCHDOWN! Mission complete.',
  crashed: 'CRASHED — press R to fly again.',
};
