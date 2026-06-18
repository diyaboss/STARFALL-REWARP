# SF_v15_TVFix

Fixes TV mode still starting as a 35-minute run.

## What changed

- Server now checks both the admin start payload and the socket `?tv=1` flag.
- If a tab is in TV mode, admin start forces the server into the 5-minute test duration.
- TV mode uses `testMatchDurationSeconds: 5 * 60`.
- Normal mode still uses `matchDurationSeconds: 35 * 60`.

## Run

```powershell
cd "C:\SF_v15_TVFix"
npm install
npm start
```

## Use

1. Open the game.
2. Click TV.
3. Enter `<set TV_CODE>`.
4. Confirm the URL has `?tv=1` or the button says `TV`.
5. Join with gamertag.
6. Admin start with `<set ADMIN_CODE>`.
7. HUD should say `TV TEST MODE: 5 minute run`.
