# Starfall Coordinate Beacon Visibility Fix

This build is the explicit Beacon Mode test build.

## Visible changes
- HUD always shows BEACON MODE BUILD.
- HUD always shows coordinate fragments: X-Alpha, X-Beta, Y-Alpha, Y-Beta.
- Each player gets one starting coordinate fragment.
- Eating a rival transfers their fragments.
- Full coordinate lock reveals the Final Beacon marker.
- Beacon activation only works in Phase 4.
- Phase 3 now visibly adds purple Dark Matter Shards near players.
- Phase 4 now visibly adds collapse overlay, nearby storms, black holes, and beacon activation window message.
- E is clarified in HUD and chat: Dark Matter Pulse spends 3 shards to drain nearby enemy mass.

## Test timing
- Match: 3 minutes.
- Respawn: 20 seconds for testing. Set `respawnDelaySeconds: 120` in `config.js` for final event.
- Final event match length: set `matchDurationSeconds: 35 * 60`.

## Important
You need at least 2 browser tabs/players to test coordinate stealing. With one player, you only see your starting 1/4 fragment.
