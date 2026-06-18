# SF_v20_CodePeekTVClean

- Added Show/Hide toggle for the admin code field in the lobby.
- If TV password is rejected, the client now exits `?tv=1` and returns to final mode instead of staying in a confusing TV-requested URL.
- TV mode still requires `TV_CODE` from `.env`.
- Admin start still requires `ADMIN_CODE` from `.env`.

If `bec` or `beaconcore` is rejected locally, create `.env` from `.env.example`, fill the codes, save, then restart `npm start`.
