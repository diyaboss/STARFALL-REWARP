# Starfall: Singularity Rush - Patch Notes

This fork converts the original Agar.io clone into a space-themed event MVP.

## Implemented

- Renamed/rebranded the game to **Starfall: Singularity Rush**.
- Added dark sci-fi UI styling.
- Replaced basic circular player rendering with:
  - a central spaceship
  - a glowing energy orb/shield that grows with mass
  - name labels outside the orb
- Replaced food pellets with glowing stardust.
- Replaced viruses with black hole/anomaly visuals.
- Added neutral neutral drones:
  - drones drift around the map
  - drones can be consumed for larger energy rewards
- Added Dark Matter Shards:
  - rare purple pickups
  - collecting 3 allows a sabotage ability
- Added sabotage ability:
  - press **E** to trigger **Dark Matter Pulse**
  - nearby enemies lose energy
  - leaked energy becomes stardust around them
  - cooldown: 45 seconds
- Added 30-minute match timer.
- Added final winner overlay:
  - winner is based on highest persistent score at timer end
- Added persistent score:
  - score increases from stardust, drones, shards, and eating players
  - score survives respawn
- Added automatic respawn after death.
- Expanded arena size and resource count for larger event play.
- Updated leaderboard to show score.

## Controls

- Mouse: move ship
- Arrow keys: move ship
- Space: split / energy burst
- W: eject energy
- E: Dark Matter Pulse sabotage when you have 3 shards
- Enter: chat

## Important Notes

- This is still a one-room global arena.
- There is no admin lobby yet.
- To reset the event match cleanly, restart the server.
- 40-player stability must be tested before the event.
- The graphics are procedural Canvas graphics, not external sprite files yet.

## 2026-06-18 Test Mode Phase Patch

- Scaled match duration down to **3 minutes** for fast testing.
  - Change `matchDurationSeconds: 3 * 60` to `matchDurationSeconds: 35 * 60` in `config.js` for the final event.
- Added story-phase system:
  1. **Arrival** - stardust collection, very light neutral traffic pressure.
  2. **Drone Awakening** - neutral drone population ramps up.
  3. **Dark Matter Breach** - sabotage unlocks and Dark Matter Shards become common.
  4. **Singularity Collapse** - final high-chaos phase with more drones, shards, black holes, and stardust storms.
- Added phase announcements in chat and a large on-screen phase banner.
- Added phase info to the HUD, including time until the next phase.
- Locked Dark Matter Pulse until Phase 3 so sabotage feels like a story unlock instead of immediate button-mashing nonsense.
- Added visible Dark Matter Pulse shockwave effect when sabotage is triggered.
- Added timed stardust storms during late phases.

## Safe Asset Note

Do not copy assets from random game zips unless their license allows reuse. Use them only for reference unless they are clearly open-source / Creative Commons / public-domain. Custom AI-generated or hand-drawn assets are safer for deployment.

## Kenney Asset Integration Patch

Added CC0 Kenney visual assets from:
- Space Shooter Redux
- Space Shooter Extension

New assets live in `src/client/img/starfall/`.

Rendering changes:
- Player cores now render real spaceship sprites inside the growing shield orb.
- neutral drones now render enemy ship sprites.
- Stardust uses star sprite assets.
- Dark Matter Shards use a power-up sprite.
- Black-hole/anomaly hazards now combine a glow with asteroid/anomaly sprite art.
- Energy mass drops use pickup sprite art.
- Background uses a parallax dark-purple space texture plus procedural stars and grid.
- Dark Matter Pulse has a richer shockwave/effect render.

The 3-minute test timer remains set in `config.js`:
`matchDurationSeconds: 3 * 60`

For the final event, change it to:
`matchDurationSeconds: 35 * 60`


## Phase balance hotfix

- Phase 2 now adds neutral drones only.
- Phase 3 now unlocks Dark Matter Shards and sabotage, without multiplying drone ships again.
- Phase 4 is now the actual escalation phase with more black holes and stardust storms.
- Test mode remains 3 minutes. Change `matchDurationSeconds` in `config.js` to scale the whole match later.


## Beacon anti-rush hotfix
- Beacon coordinates can be collected early, but activation is locked until Phase 4 / 75% match progress.
- Early coordinate holders become visible threats instead of instantly ending the match.
- Leaderboard now updates score/mass values continuously, not only when rank order changes.
