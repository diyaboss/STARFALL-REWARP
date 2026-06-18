# SF_v21_TVDefaultFix

- Default load always starts in final 35-minute mode.
- Old `?tv=1` URL is cleaned on load and does not arm TV mode.
- TV mode only arms after clicking the tiny TV button and entering the TV code.
- When armed, the tiny button says `TV ON`.
- If TV password is rejected, TV mode turns off and the button returns to `TV`.
