# SF_v19_WarpEnv

Changes:
- Removed hardcoded admin and TV secrets from code/config.
- Reads ADMIN_CODE and TV_CODE from environment variables or local .env.
- Removed hard world boundary clamp so players do not stop near the old map edge.
- Added far-space warning popup pointing players back toward the relay lanes.
- Added Warp Drive: F key / button, super speed for a few seconds, 3-minute cooldown.
- TV button stays tiny and does not persist as default mode unless URL has ?tv=1.

Local setup:
1. Copy `.env.example` to `.env`.
2. Fill ADMIN_CODE and TV_CODE.
3. Run `npm install` then `npm start`.
