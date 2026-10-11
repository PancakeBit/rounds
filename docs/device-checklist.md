# Rounds: device checklist

Updated 2026-10-12 after the first device run. Changes from that feedback: plain numbers with no currency, an "Extra" per person, several nights open at once, the "Someone paid" wording, Settle up at the very bottom, and press animations. Amounts below are plain numbers.

## Setup

1. Install over the old version: `~/Android/Sdk/platform-tools/adb install -r dist/rounds.apk`. It must install over the old one, not fail with a signature mismatch. Old nights must still be there, with the same balances.
2. Home: slate and chalk, no gear icon, and a "Start a night" button that is always there.
3. **Press feel:** tap anything. It sinks at once, springs back with a small bounce, and a ring bursts outward and fades. You feel a light tick on every touch.
4. Crew: add Jo, Sam, Kai and Mia. Shuffle a face, rename one, retire one, then bring them back.

## A full night

5. Start a night with Jo, Sam and Kai. The line-up now has a **Group shot** tile at the start too. Snap Jo and Sam, leave Kai, take a start group shot, and tap Done.
   - **Check:** are the front-camera photos mirrored or rotated compared with the preview?
6. The night screen: the bottom panel has **Someone paid**, then **Settle up** below it with a clear gap. The top row has Faces, Add someone and Recap.
7. Tap Someone paid for each of these, and check the columns after each one.
   1. Jo pays `30`, Drinks, everyone at 1 → Jo `+20.00`, Sam `-10.00`, Kai `-10.00`. Each digit pops as you type it.
   2. Type `9999999.99`: the amount shrinks to fit and doesn't overflow. Clear it.
   3. Sam pays `10`, everyone at 1 → the preview reads `3.34 / 3.33 / 3.33`.
   4. **One extra item:** Kai pays `60`. Tap **+ Extra** on Sam and set `15`. Everyone stays at 1 → Sam `30.00`, Jo `15.00`, Kai `15.00`. The line under the list reads "Extras 15.00 · the other 45.00 split between 3".
   5. **Different orders:** Jo pays `100`. Set extras Jo `30`, Sam `20` and Kai `10`, with everyone at 1 → Jo `43.34`, Sam `33.33`, Kai `23.33`. The leftover 40 is split evenly.
   6. **Only their own thing:** with an extra on Sam, press − on Sam until it shows 0 → Sam pays only their extra.
   7. Sam pays `12` with **On me** → balances don't change, and the item shows a circled ON ME.
   8. Jo pays `8` and taps **For Sam** → the other shares drop to 0, and Sam shows `100%`.
8. Edge cases on that screen:
   - With "For Sam" lit and Jo paying, switch the payer to Sam → everyone goes back to 1.
   - Extras adding up to more than the bill → "Extras add up to more than the bill", and Save is disabled.
   - Every share at 0 with no extras → "Nobody is sharing the rest".
   - Tap **+ Extra**, then **No extra** → the extra is cleared.
   - Double-tap Save → only one item is created.
9. Tap an item, change it to `36` and save: the balances update. Hold an item: chalk strike, it's removed, and "Removed · Undo" appears **above** the bottom panel. Tap Undo and it comes back.
10. **Late arrival:** Add someone → Mia. Her column reads `0.00 square`, and new items include her.

## Several nights open

11. Go back to Home. "Still open" shows tonight with what's still unpaid. Tap **Start a night** and start a second one with Jo and Mia. Home now lists both.
12. Log something on the second night. Go back: each open night shows its own unpaid figure.

## Settle up and the finish

13. On the first night, tap Settle up. Each row reads `Jo pays Sam`, with each name in that person's colour and both avatars (payer on the left, payee on the right). Scoreboard column names are in their colours too. The transfers clear the scoreboard balances. Tick one: the big number gets a strike and the next one drops in.
14. Leave it half-ticked, kill the app, and reopen it. The night is still under Still open, and the ticks are kept.
15. Tick the rest, then **Close the night** → ALL SQUARE, chalk dust, two haptic thunks. The night moves to Past nights, and the other night stays open.
16. Recap has two tabs.
    - **The receipt:** every item with who paid (in their colour) and how it was split, the TOTAL, then Who owes who with paid rows struck and marked PAID, and the three titles. **Send the receipt** sends a complete, legible image. **Send as text** shows extras as `Sam +15.00`.
    - **The photos:** a collage of the start faces, the group shots and the end faces. **Shuffle the layout** cycles through every layout that fits. Check each one for clipped or overflowing photos and text, then **Send the photos** and check the image.
    - Photo combinations to try, using a fresh night each time (hold a photo on Faces to remove it):
      - no photos at all → "No photos from this night" with a Take some button
      - one face only
      - only the end group shot
      - start and end faces, no group shot
      - both group shots and no faces
      - everything
    - The same night always opens on the same layout, and different nights open on different ones.
17. A past night is read-only: no bottom panel and no Add someone.

## Phone settings

18. **Navigation bar:** with 3-button navigation and again with gestures, nothing sits under the bar. That covers the bottom panel, the Undo bar, the camera shutter, and the last button on each scrolling screen.
19. **Remove animations** (Accessibility): taps still give the haptic but don't sink or ring, rows appear without dropping in, and ALL SQUARE has no dust.
20. **Camera denied:** run `adb shell pm revoke com.joshua.rounds android.permission.CAMERA`, then tap a face → the "needs the camera" screen, and Skip works.
