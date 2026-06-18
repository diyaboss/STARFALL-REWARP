# Run SF_v19_WarpEnv

This version has no hardcoded admin/TV passwords.

## Local setup

1. Copy `.env.example` to `.env`.
2. Put your real values in `.env`:

```env
ADMIN_CODE=your-admin-code
TV_CODE=your-tv-password
```

3. Run:

```powershell
npm install
npm start
```

4. Open:

```text
http://localhost:3000
```

## Deploy setup

Set these environment variables in Render/Railway/hosting provider:

```text
ADMIN_CODE
TV_CODE
PORT
```

Do not commit `.env`.

## Controls

- Mouse = movement
- Space = Energy Burst
- E = Dark Pulse
- F = Warp Drive, usable once every 3 minutes

## Notes

- Main mode defaults to 35 minutes.
- TV mode only activates when the TV button is clicked and `?tv=1` is present.
- Movement no longer hard-stops at the old map edge.
