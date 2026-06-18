# Starfall Lobby + Beacon Navigation Update

This build adds the requested event-control and coordinate-navigation features.

## New in this build

- Lobby flow added.
  - Players enter a gamertag and join the staging lobby.
  - Movement is frozen until the coordinator starts the game.
  - Admin starts the match from the lobby using the admin code.
  - Admin code is set in `config.js` as `adminPass: "<set ADMIN_CODE>"`.

- Beacon navigation clarity added.
  - HUD now shows the player's current coordinate: `X` and `Y`.
  - HUD shows coordinate fragments: `X-Alpha`, `X-Beta`, `Y-Alpha`, `Y-Beta`.
  - Once a player has all four fragments, HUD shows beacon delta and distance from current position.
  - Beacon can only be activated in Phase 4.
  - If no one activates the beacon before time ends, highest score wins.

- Movement pause button added.
  - Button: `Stop movement` / `Start movement`.
  - Useful when typing, reading coordinates, or explaining rules.

- Panels can be minimised.
  - Small `×` buttons added to HUD, leaderboard, and chat.
  - `Show panels` restores them.

- Phase banners last longer.
  - Banners now stay for ~8.5 seconds.
  - Subtext has been rewritten to make each chapter feel more like a story beat.

- Size scaling fixed.
  - Player mass is capped by `maxPlayerMassTotal: 360` in `config.js`.
  - Score keeps increasing, but the visible orb will not keep growing forever.

## Test timing

This build is still set to 3 minutes:

```js
matchDurationSeconds: 3 * 60
respawnDelaySeconds: 20
```

For the final event:

```js
matchDurationSeconds: 35 * 60
respawnDelaySeconds: 120
```

## Local run

```powershell
cd "C:\starfall-singularity-rush-lobby-beacon-update"
npm install
npm start
```

Open:

```text
http://localhost:3000
```
