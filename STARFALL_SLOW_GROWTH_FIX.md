# Starfall Slow Growth Fix

This build slows visible/playable growth for event use.

- Player score can still increase normally.
- Shield/orb size grows much slower.
- Playable mass is capped at 150 instead of 360.
- Food mass gain reduced to 0.35.
- Drone mass gain reduced to 6.
- Radius formula changed from 4 + sqrt(mass) * 6 to 16 + sqrt(mass) * 2.2.

Result: even in a 35-minute match, ships should not cover the screen.
