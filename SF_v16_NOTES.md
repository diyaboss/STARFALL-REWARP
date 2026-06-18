# SF_v16_LobbyTVDrifters

Changes:
- Removed the event-build pill from the gamertag screen.
- Removed the Spectate button from the gamertag screen.
- Restyled the start/lobby UI with a darker cyan/orange Starfall look.
- Hardened TV mode detection: TV mode can now force a fresh 5-minute run even if a previous run was active.
- Added a fresh-match reset when admin starts, so switching between final and TV mode does not inherit old timer/player state.
- Increased local drifter ship presence. The server now tries to keep 4-6 small drifter ships around each active pilot's visible area.
- Main mode remains 35 minutes. TV mode remains 5 minutes with password `<set TV_CODE>`.

Run:
```powershell
cd "C:\SF_v16_LobbyTVDrifters"
npm install
npm start
```
