# Aurora Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/zhliu2878-cell/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/zhliu2878-cell/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A dawn-patrol flight game. Fly a little orange prop plane out of a mountain
valley at sunrise: thread 8 glowing rings, watch your fuel, and bring her
home onto the runway for a scored landing. Built with three.js, all original
code, art and sound — no network requests at run time, everything is static
files under `game/`.

## How to play

Serve the game folder with any static server and open `game/index.html`:

```sh
python3 -m http.server --directory game 8000
```

or open `game/index.html` directly from a local server of your choice.

### Controls

| Input | Action |
| --- | --- |
| W / S or ↑ / ↓ | Pitch up / down |
| A / D or ← / → | Roll and turn |
| Shift / Ctrl | Throttle up / down |
| Mouse drag | Steer (pitch + roll) |
| R | Restart |
| P | Pause |

### Mission

1. **Ring Run** — fly through all 8 glowing gold rings in order. The next
   ring glows brightest. Each ring is +250 points.
2. **Fuel** — throttle burns fuel. Run low and a green fuel ring over the
   lake refills the tank.
3. **Landing** — with all rings clear, land on the runway: slow, sinking
   gently, on the centreline. Landing quality and remaining time add bonus
   points. Hit the ground hard and the plane is damaged; at 100% damage
   the flight is over.

The HUD shows altitude (ft), speed (kt), heading compass, throttle, fuel,
damage, score, mission text and the timer. Engine hum, wind, ring chimes
and landing sounds are all synthesised with WebAudio — no audio files.

## Layout

- `game/index.html` — the page; loads three.js, then the game modules.
- `game/src/config.js` — tuning constants (flight model, rings, landing).
- `game/src/world.js` — procedural terrain, sky, sun, clouds, runway, rings.
- `game/src/plane.js` — the aircraft mesh (three.js primitives) + flight model.
- `game/src/input.js` — keyboard + mouse steering.
- `game/src/hud.js` — the lit instrument overlay.
- `game/src/audio.js` — synthesised engine, wind and effects.
- `game/src/missions.js` — Ring Run, fuel ring, landing scoring, game over.
- `game/src/shots.js` — deterministic staging for `?shot=start|play|end`.
- `game/src/main.js` — bootstrap + game loop.
- `game/vendor/three.min.js` — three.js 0.149 (MIT), vendored.
- `screenshots/` — renders of the game's own code in a browser.
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to the
  output directory and writes `dossier.json` (Node 22/24, stdlib only).

## License

MIT — see [LICENSE](LICENSE).
