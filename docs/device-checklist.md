# Rounds: device checklist for v1

No phone or emulator was attached during the build. Everything below compiles and passes 57 unit tests, but has not run on Android yet. Run through this once on your phone after installing the signed APK. Numbers assume USD.

## Setup

1. Install: `~/Android/Sdk/platform-tools/adb install -r dist/rounds.apk`, or copy `dist/rounds.apk` to the phone and open it.
2. The app opens on Home in slate and chalk, with Big Shoulders headings and Barlow body text, and a "Start a night" button.
3. Crew: add Jo, Sam, Kai and Mia. Tap a face to shuffle it. Rename one. Retire one: they drop off the Home crew strip. Bring them back.
4. Settings: set the currency to `PHP` and save. The preview reads like `₱12.34`. Set it back to `USD`.

## A full night

5. Start a night with Jo, Sam and Kai. The line-up opens. Allow the camera. Snap Jo with the front camera inside the ring, then Sam. Leave Kai. Tap Done.
   - Expect the scoreboard: `$0` tab, Jo and Sam with photos, Kai with an emoji, every column `$0 square`.
   - **Check:** are the front-camera photos mirrored or rotated compared with the preview? Rotated faces would end up on the shared recap.
6. Chalk up these rounds and check the columns after each one. The old figure gets a chalk strike and the new one drops in.
   1. Jo pays `30`, Drinks, everyone at 1 share → Jo `+$20`, Sam `−$10`, Kai `−$10`.
   2. Sam pays `10`, everyone at 1 → the preview shows `3.34 / 3.33 / 3.33` and `33%` each.
   3. Kai pays `60`, Food. Long-press Sam and set exactly `30`. Jo and Kai stay at 1 → preview Sam `30.00`, Jo `15.00`, Kai `15.00`.
   4. Sam pays `12` with **On me** → balances don't change, and the round shows a circled ON ME.
   5. Jo pays `8`, taps **For Sam** → the other steppers drop to 0, Sam shows `100%`. Save: Jo `+$8` more, Sam `−$8` more.
7. Edge cases on the round screen:
   - With "For Sam" lit and Jo paying, switch the payer to Sam → everyone goes back to 1 share.
   - Set Kai to 0, long-press Kai, choose "No fixed amount" → Kai stays out. Set an exact amount on Kai, then clear it → Kai is out again.
   - Set exactly `100` on a `60` bill → "Fixed amounts exceed the bill", and Save is disabled.
   - Set every stepper to 0 → "Nobody is splitting the rest".
   - Double-tap Save → only one round is created.
8. Tap round 1, change it to `36` and save: the balances update. Hold round 2: chalk strike, it's wiped, and the Undo bar appears **above** the "Chalk up a round" bar. Tap Undo: the round comes back with the same split.
9. **Late arrival:** tap Add someone and add Mia. Her column reads `$0 square`, and earlier rounds don't include her. Log a round and Mia is in by default. Add someone again: Mia is no longer offered.
10. Settings: the currency now says only codes with the same decimal places work. USD → EUR saves; USD → JPY shows the "Locked to 2 decimal places" message. Set it back to USD.

## Settle up and the finish

11. Tap Settle up. Hand-check that the transfers clear the scoreboard balances. The big number equals the number of rows.
12. Tick one transfer: the big number gets a chalk strike and the next one drops in. Go back, edit a round's amount, and return. The ticked row is still ticked and the others are recomputed, so nobody pays twice.
13. Tick every row: the night stays **open**, and "Everyone's paid. Close the night when you're done." appears with a green button. Untick one and the button hides. Tick it again, then tap **Close the night** → green ALL SQUARE, a chalk-dust puff, two haptic thunks.
14. On ALL SQUARE, tap "One more for the board". Snap Jo and Kai, then the group shot with the back camera. Done opens the recap.
15. Recap:
    - Check the total, Big Spender, Most Generous, The Sponge and the category bars.
    - Faces: there's a start row and an end row, missing photos show an emoji, and the group shot appears.
    - **Hide faces** switches it to emoji.
    - **Send to the group**: send it to a chat and confirm the image is complete and legible. Send it once with faces and once with them hidden.
    - **Send as text**: check the round lines (`everyone`, `for Sam`, `on me`) and `(paid)` on the ticked transfers.
16. Back to Home: no active night, and the night is under Past nights. Open it: it's read-only, with no "Chalk up a round", no "Add someone", and rounds aren't tappable.
17. Retire Kai on Crew, then reopen that past night: Kai is still there with his balance.

## Phone settings

18. **Navigation bar:** with 3-button navigation and again with gesture navigation, nothing sits under the bar. That covers the "Chalk up a round" bar, the Undo bar, the camera shutter, and the last button on every scrolling screen.
19. **Remove animations** (Accessibility): repeat a tick on Settle up. Figures swap instantly, strikes appear fully drawn, and ALL SQUARE shows with no dust. Turn it back off.
20. **Camera denied:** run `adb shell pm revoke com.joshua.rounds android.permission.CAMERA`, then open Faces and tap a face. You see the "needs the camera" screen, and "Skip, keep the emoji" works. Deny twice and the screen points to Android settings.
21. Swipe the app away and reopen it. The active night, rounds and photos are all still there.
22. Install a rebuilt APK over it with `adb install -r`. It must install over the old one, not fail with a signature mismatch.
