# Starfall Run Fix

This build changes `npm start` to use `gulp watch`, which skips the old regression tests during local dev. The old tests expected the original Agar.io radius formula, but Starfall intentionally uses slower shield growth.

Run:

```powershell
npm install
npm start
```

Strict build/tests can still be run manually with `npm run build`, and the massToRadius test expectations have been updated for the Starfall formula.
